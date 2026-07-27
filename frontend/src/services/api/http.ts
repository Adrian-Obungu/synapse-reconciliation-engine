/**
 * Resilient HTTP transport engine for the Synapse Reconciliation Engine.
 * 
 * Features:
 * - Automatic /api/v1 route prefix prepended to all paths
 * - Dynamic JWT Bearer token injection from Supabase session
 * - Per-attempt AbortController with 15-second timeout
 * - Linear retry with ±200ms jitter (max 3 attempts) for retryable errors
 * - Silent 401 token refresh + request replay before redirect
 * - All responses normalized into strict ApiResult<T> discriminated union
 */

import type { ApiResult, ApiError } from '../../lib/types';
import {
  API_VERSION,
  REQUEST_TIMEOUT_MS,
  MAX_RETRY_ATTEMPTS,
  RETRY_JITTER_MS,
} from '../../lib/constants';
import { ENV } from '../../lib/env';
import { getAccessToken, refreshSession } from '../supabase/auth';
import {
  normalizeNetworkError,
  normalizeTimeoutError,
  normalizeHttpError,
} from './interceptors';

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Constructs the full URL from base + API version prefix + path. */
function buildUrl(path: string): string {
  const base = ENV.API_BASE_URL.replace(/\/+$/, ''); // Strip trailing slashes
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${API_VERSION}${normalizedPath}`;
}

/** Computes linear retry delay with random jitter. */
function computeRetryDelay(attempt: number): number {
  const baseDelay = attempt * 1000; // 1s, 2s, 3s
  const jitter = Math.floor(Math.random() * RETRY_JITTER_MS * 2) - RETRY_JITTER_MS;
  return baseDelay + jitter;
}

/** Returns a promise that resolves after the specified milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Navigates to the login page with an optional reason parameter. */
function redirectToLogin(reason?: string): void {
  const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  window.location.href = `/login${params}`;
}

// ---------------------------------------------------------------------------
// Core Transport
// ---------------------------------------------------------------------------

interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

/**
 * Core request executor with retry logic, timeout, and error normalization.
 * 
 * Retry behavior:
 * - Only retries errors marked as `retryable: true` by the interceptor
 * - Uses linear backoff: ~1s, ~2s, ~3s with ±200ms random jitter
 * - Each attempt gets a fresh 15-second AbortController
 * 
 * 401 handling:
 * - Attempts one silent token refresh via Supabase
 * - If refresh succeeds, replays the original request with the new token
 * - If refresh fails, redirects to /login?reason=session_expired
 * - 401s are NEVER retried through the normal retry loop
 */
async function executeRequest<T>(options: RequestOptions): Promise<ApiResult<T>> {
  const { method, path, body, headers: customHeaders, isFormData } = options;
  const url = buildUrl(path);

  let lastError: ApiError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    // Fresh AbortController per attempt (15s timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // Dynamically fetch JWT for each attempt (may have been refreshed)
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        ...customHeaders,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Don't set Content-Type for FormData — browser sets it with boundary
      if (!isFormData && body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        method,
        headers,
        body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ── Success path ─────────────────────────────────────────
      if (response.ok) {
        // Handle 204 No Content
        if (response.status === 204) {
          return { ok: true, data: undefined as T };
        }

        try {
          const data = (await response.json()) as T;
          return { ok: true, data };
        } catch {
          // Response was 2xx but body wasn't valid JSON
          return {
            ok: false,
            error: {
              code: 'PARSE_ERROR',
              message: 'The server returned an invalid response.',
              status: response.status,
              retryable: false,
            },
          };
        }
      }

      // ── 401 special handling (NOT part of retry loop) ─────────
      if (response.status === 401) {
        const refreshed = await refreshSession();

        if (refreshed) {
          // Replay the original request with the new token
          const newToken = await getAccessToken();
          const replayHeaders: Record<string, string> = { ...customHeaders };

          if (newToken) {
            replayHeaders['Authorization'] = `Bearer ${newToken}`;
          }
          if (!isFormData && body !== undefined) {
            replayHeaders['Content-Type'] = 'application/json';
          }

          const replayController = new AbortController();
          const replayTimeoutId = setTimeout(
            () => replayController.abort(),
            REQUEST_TIMEOUT_MS
          );

          try {
            const replayResponse = await fetch(url, {
              method,
              headers: replayHeaders,
              body: isFormData
                ? (body as FormData)
                : body !== undefined
                  ? JSON.stringify(body)
                  : undefined,
              signal: replayController.signal,
            });

            clearTimeout(replayTimeoutId);

            if (replayResponse.ok) {
              if (replayResponse.status === 204) {
                return { ok: true, data: undefined as T };
              }
              const data = (await replayResponse.json()) as T;
              return { ok: true, data };
            }

            // Replay also failed — redirect to login
            redirectToLogin('session_expired');
            return {
              ok: false,
              error: await normalizeHttpError(replayResponse),
            };
          } catch {
            clearTimeout(replayTimeoutId);
            redirectToLogin('session_expired');
            return {
              ok: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Your session has expired. Please log in again.',
                status: 401,
                retryable: false,
              },
            };
          }
        }

        // Refresh failed — redirect immediately
        redirectToLogin('session_expired');
        return {
          ok: false,
          error: await normalizeHttpError(response),
        };
      }

      // ── Other HTTP errors ─────────────────────────────────────
      const httpError = await normalizeHttpError(response);

      if (httpError.retryable && attempt < MAX_RETRY_ATTEMPTS) {
        lastError = httpError;
        await sleep(computeRetryDelay(attempt));
        continue;
      }

      return { ok: false, error: httpError };

    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // ── Timeout (AbortError) ──────────────────────────────────
      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = normalizeTimeoutError();

        if (attempt < MAX_RETRY_ATTEMPTS) {
          lastError = timeoutError;
          await sleep(computeRetryDelay(attempt));
          continue;
        }

        return { ok: false, error: timeoutError };
      }

      // ── Network error ─────────────────────────────────────────
      const networkError = normalizeNetworkError(error);

      if (attempt < MAX_RETRY_ATTEMPTS) {
        lastError = networkError;
        await sleep(computeRetryDelay(attempt));
        continue;
      }

      return { ok: false, error: networkError };
    }
  }

  // Should never reach here, but TypeScript needs the return
  return {
    ok: false,
    error: lastError ?? {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
      status: 0,
      retryable: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Performs a GET request to the specified API path. */
export function httpGet<T>(path: string): Promise<ApiResult<T>> {
  return executeRequest<T>({ method: 'GET', path });
}

/** Performs a POST request with a JSON body. */
export function httpPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return executeRequest<T>({ method: 'POST', path, body });
}

/** Performs a PUT request with a JSON body. */
export function httpPut<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return executeRequest<T>({ method: 'PUT', path, body });
}

/** Performs a PATCH request with a JSON body. */
export function httpPatch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return executeRequest<T>({ method: 'PATCH', path, body });
}

/** Performs a DELETE request. */
export function httpDelete<T>(path: string): Promise<ApiResult<T>> {
  return executeRequest<T>({ method: 'DELETE', path });
}

/**
 * Performs a file upload via multipart/form-data.
 * Does NOT set Content-Type header — the browser sets it automatically
 * with the correct multipart boundary.
 */
export function httpUpload<T>(path: string, formData: FormData): Promise<ApiResult<T>> {
  return executeRequest<T>({
    method: 'POST',
    path,
    body: formData,
    isFormData: true,
  });
}

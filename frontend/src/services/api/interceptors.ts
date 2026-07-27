/**
 * HTTP error normalization interceptor for the Synapse Reconciliation Engine.
 * Converts all network, timeout, and HTTP failures into a strict ApiError
 * interface with machine-readable codes and retryable flags.
 * 
 * Retryable errors (automatic retry eligible):
 * - Network errors (TypeError from fetch)
 * - AbortController timeouts
 * - HTTP 429 (Too Many Requests)
 * - HTTP 502, 503, 504 (Gateway/Server errors)
 * 
 * Non-retryable errors (immediate failure):
 * - HTTP 400 (Bad Request / Validation)
 * - HTTP 401 (Unauthorized)
 * - HTTP 403 (Forbidden)
 * - HTTP 404 (Not Found)
 * - HTTP 422 (Unprocessable Entity)
 * - JSON parse errors
 */

import type { ApiError } from '../../lib/types';

/**
 * Normalizes a network/fetch error (TypeError) into an ApiError.
 * These occur when the network is unreachable, DNS fails, CORS blocks, etc.
 */
export function normalizeNetworkError(_error: unknown): ApiError {
  return {
    code: 'NETWORK_ERROR',
    message: 'Unable to reach the server. Please check your internet connection.',
    status: 0,
    retryable: true,
  };
}

/**
 * Normalizes an AbortController timeout into an ApiError.
 */
export function normalizeTimeoutError(): ApiError {
  return {
    code: 'TIMEOUT',
    message: 'The request timed out. The server may be experiencing high load.',
    status: -1,
    retryable: true,
  };
}

/**
 * Normalizes an HTTP response with a non-2xx status code into an ApiError.
 * Attempts to extract error details from the response body for 400/422 errors.
 * 
 * @param response - The fetch Response object
 * @returns Normalized ApiError
 */
export async function normalizeHttpError(response: Response): Promise<ApiError> {
  let body: Record<string, unknown> | null = null;

  try {
    body = await response.json();
  } catch {
    // Response body is not JSON — proceed with status-only mapping
  }

  const message = typeof body?.message === 'string'
    ? body.message
    : typeof body?.detail === 'string'
      ? body.detail
      : getDefaultMessage(response.status);

  const details = (response.status === 400 || response.status === 422)
    ? extractValidationDetails(body)
    : undefined;

  return {
    code: getErrorCode(response.status),
    message,
    status: response.status,
    retryable: isRetryableStatus(response.status),
    ...(details && { details }),
  };
}

/**
 * Determines whether an HTTP status code indicates a retryable error.
 * 
 * Retryable: 429 (rate limited), 502/503/504 (gateway/server errors)
 * Non-retryable: all 4xx (except 429), other 5xx
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/** Maps HTTP status codes to machine-readable error codes. */
function getErrorCode(status: number): string {
  const codeMap: Record<number, string> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE',
    429: 'RATE_LIMITED',
    500: 'SERVER_ERROR',
    502: 'SERVER_ERROR',
    503: 'SERVER_ERROR',
    504: 'SERVER_ERROR',
  };

  return codeMap[status] ?? 'UNKNOWN_ERROR';
}

/** Returns a sensible default error message for common HTTP status codes. */
function getDefaultMessage(status: number): string {
  const messageMap: Record<number, string> = {
    400: 'The request contained invalid data. Please check your input.',
    401: 'Your session has expired. Please log in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'A conflict occurred. The resource may have been modified.',
    422: 'The submitted data could not be processed.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'An internal server error occurred.',
    502: 'The server is temporarily unavailable.',
    503: 'The service is temporarily unavailable for maintenance.',
    504: 'The server took too long to respond.',
  };

  return messageMap[status] ?? `An unexpected error occurred (HTTP ${status}).`;
}

/**
 * Extracts field-level validation errors from a 400/422 response body.
 * Handles both FastAPI/Pydantic `detail` arrays and flat error objects.
 */
function extractValidationDetails(
  body: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!body) return undefined;

  // FastAPI/Pydantic format: { detail: [{ loc: [...], msg: '...', type: '...' }] }
  if (Array.isArray(body.detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const err of body.detail) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'loc' in err &&
        'msg' in err &&
        Array.isArray((err as Record<string, unknown>).loc)
      ) {
        const loc = (err as Record<string, unknown[]>).loc;
        const fieldName = loc[loc.length - 1];
        if (typeof fieldName === 'string') {
          fieldErrors[fieldName] = String((err as Record<string, unknown>).msg);
        }
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return fieldErrors;
    }
  }

  // Flat error object: { errors: { field: 'message' } }
  if (
    typeof body.errors === 'object' &&
    body.errors !== null &&
    !Array.isArray(body.errors)
  ) {
    return body.errors as Record<string, unknown>;
  }

  return undefined;
}

/**
 * Unit tests for the HTTP transport engine in src/services/api/http.ts.
 *
 * Tests cover:
 * - URL construction (base + /api/v1 + path)
 * - Bearer token injection from Supabase session
 * - Retry behavior: 3 attempts on retryable errors, no retry on non-retryable
 * - 401 silent refresh + replay flow
 * - Successful response parsing
 * - Network error handling
 *
 * Each test uses vi.resetModules() to ensure the http module is freshly
 * imported, preventing accumulated mock state across tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock references (reset per test)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGetAccessToken: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockRefreshSession: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFetch: any;

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('HTTP Transport Engine', () => {
  beforeEach(() => {
    // Reset module registry so each test gets a fresh http.ts import
    vi.resetModules();

    // Create fresh mocks
    mockGetAccessToken = vi.fn().mockResolvedValue('test-jwt-token');
    mockRefreshSession = vi.fn().mockResolvedValue(false);
    mockFetch = vi.fn();

    // Assign global fetch mock
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    // Mock env module
    vi.doMock('../../../lib/env', () => ({
      ENV: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        API_BASE_URL: 'https://api.test.com',
      },
    }));

    // Mock auth module
    vi.doMock('../../supabase/auth', () => ({
      getAccessToken: () => mockGetAccessToken(),
      refreshSession: () => mockRefreshSession(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Dynamically import http.ts after mocks are configured. */
  async function getHttp() {
    return await import('../http');
  }

  /** Helper to create a mock Response with an optional JSON body. */
  function mockResponse(status: number, body?: unknown): Response {
    return new Response(
      body !== undefined ? JSON.stringify(body) : null,
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // -----------------------------------------------------------------------
  // URL Construction
  // -----------------------------------------------------------------------

  describe('URL Construction', () => {
    it('constructs URL with base + /api/v1 + path', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, { id: '1' }));
      const { httpGet } = await getHttp();

      await httpGet('/transactions');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/transactions',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles path without leading slash', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, { id: '1' }));
      const { httpGet } = await getHttp();

      await httpGet('transactions');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/transactions',
        expect.any(Object)
      );
    });
  });

  // -----------------------------------------------------------------------
  // Bearer Token Injection
  // -----------------------------------------------------------------------

  describe('Bearer Token Injection', () => {
    it('injects JWT as Authorization Bearer header', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));
      const { httpGet } = await getHttp();

      await httpGet('/test');

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-jwt-token');
    });

    it('omits Authorization header when no token is available', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      mockFetch.mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));
      const { httpGet } = await getHttp();

      await httpGet('/test');

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Successful Responses
  // -----------------------------------------------------------------------

  describe('Successful Responses', () => {
    it('returns { ok: true, data } for 200 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { id: '1', name: 'Test' })
      );
      const { httpGet } = await getHttp();

      const result = await httpGet<{ id: string; name: string }>('/test');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ id: '1', name: 'Test' });
      }
    });

    it('handles 204 No Content responses', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
      const { httpDelete } = await getHttp();

      const result = await httpDelete('/test/1');

      expect(result.ok).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Retry Behavior
  // -----------------------------------------------------------------------

  describe('Retry Behavior', () => {
    it('retries up to 3 times on retryable errors (503)', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse(503))
        .mockResolvedValueOnce(mockResponse(503))
        .mockResolvedValueOnce(mockResponse(200, { ok: true }));

      const { httpGet } = await getHttp();

      const result = await httpGet('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(true);
    });

    it('does NOT retry on non-retryable errors (400)', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(400, { message: 'Bad request' })
      );
      const { httpGet } = await getHttp();

      const result = await httpGet('/test');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns the last error after all retries exhausted', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse(503))
        .mockResolvedValueOnce(mockResponse(503))
        .mockResolvedValueOnce(mockResponse(503));

      const { httpGet } = await getHttp();

      const result = await httpGet('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SERVER_ERROR');
        expect(result.error.retryable).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 401 Silent Refresh + Replay
  // -----------------------------------------------------------------------

  describe('401 Silent Refresh + Replay', () => {
    it('attempts token refresh on 401, replays request on success', async () => {
      mockRefreshSession.mockResolvedValueOnce(true);
      mockGetAccessToken
        .mockResolvedValueOnce('old-token')    // First attempt
        .mockResolvedValueOnce('new-token');    // After refresh

      mockFetch
        .mockResolvedValueOnce(mockResponse(401))
        .mockResolvedValueOnce(mockResponse(200, { ok: true }));

      const { httpGet } = await getHttp();

      const result = await httpGet('/test');

      expect(mockRefreshSession).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });

    it('returns error when refresh fails', async () => {
      mockRefreshSession.mockResolvedValueOnce(false);
      mockFetch.mockResolvedValueOnce(mockResponse(401));

      // Mock window.location.href setter to prevent navigation in test
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, href: '' },
        writable: true,
        configurable: true,
      });

      const { httpGet } = await getHttp();

      const result = await httpGet('/test');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.status).toBe(401);
      }

      // Restore original location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });

  // -----------------------------------------------------------------------
  // POST with JSON Body
  // -----------------------------------------------------------------------

  describe('POST with JSON Body', () => {
    it('sets Content-Type to application/json and stringifies body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(201, { id: '1' }));
      const { httpPost } = await getHttp();

      await httpPost('/test', { name: 'Test', amount: 100 });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(callArgs[1]?.body).toBe(JSON.stringify({ name: 'Test', amount: 100 }));
    });
  });

  // -----------------------------------------------------------------------
  // Network Errors
  // -----------------------------------------------------------------------

  describe('Network Errors', () => {
    it('retries on network errors and returns NETWORK_ERROR after exhaustion', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const { httpGet } = await getHttp();

      const result = await httpGet('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.retryable).toBe(true);
      }
    });
  });
});

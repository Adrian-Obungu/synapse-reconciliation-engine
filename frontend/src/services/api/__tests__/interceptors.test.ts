/**
 * Unit tests for the HTTP error interceptor in src/services/api/interceptors.ts.
 *
 * Tests cover:
 * - Network error normalization
 * - Timeout error normalization
 * - HTTP status code → ApiError mapping for all documented codes
 * - Retryable flag correctness
 * - Validation details extraction from 400/422 responses
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeNetworkError,
  normalizeTimeoutError,
  normalizeHttpError,
  isRetryableStatus,
} from '../interceptors';

// ---------------------------------------------------------------------------
// normalizeNetworkError
// ---------------------------------------------------------------------------

describe('normalizeNetworkError', () => {
  it('returns a NETWORK_ERROR with status 0 and retryable: true', () => {
    const error = normalizeNetworkError(new TypeError('Failed to fetch'));
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
    expect(error.retryable).toBe(true);
    expect(error.message).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// normalizeTimeoutError
// ---------------------------------------------------------------------------

describe('normalizeTimeoutError', () => {
  it('returns a TIMEOUT error with status -1 and retryable: true', () => {
    const error = normalizeTimeoutError();
    expect(error.code).toBe('TIMEOUT');
    expect(error.status).toBe(-1);
    expect(error.retryable).toBe(true);
    expect(error.message).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// isRetryableStatus
// ---------------------------------------------------------------------------

describe('isRetryableStatus', () => {
  it('marks 429 as retryable', () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it('marks 502 as retryable', () => {
    expect(isRetryableStatus(502)).toBe(true);
  });

  it('marks 503 as retryable', () => {
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('marks 504 as retryable', () => {
    expect(isRetryableStatus(504)).toBe(true);
  });

  it('marks 400 as NOT retryable', () => {
    expect(isRetryableStatus(400)).toBe(false);
  });

  it('marks 401 as NOT retryable', () => {
    expect(isRetryableStatus(401)).toBe(false);
  });

  it('marks 403 as NOT retryable', () => {
    expect(isRetryableStatus(403)).toBe(false);
  });

  it('marks 404 as NOT retryable', () => {
    expect(isRetryableStatus(404)).toBe(false);
  });

  it('marks 500 as NOT retryable', () => {
    expect(isRetryableStatus(500)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeHttpError
// ---------------------------------------------------------------------------

describe('normalizeHttpError', () => {
  /** Helper to create a mock Response with JSON body. */
  function mockResponse(
    status: number,
    body?: Record<string, unknown>
  ): Response {
    return new Response(body ? JSON.stringify(body) : null, {
      status,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    });
  }

  it('maps 400 to VALIDATION_ERROR (non-retryable)', async () => {
    const error = await normalizeHttpError(mockResponse(400, { message: 'Bad input' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
    expect(error.retryable).toBe(false);
    expect(error.message).toBe('Bad input');
  });

  it('maps 401 to UNAUTHORIZED (non-retryable)', async () => {
    const error = await normalizeHttpError(mockResponse(401));
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.status).toBe(401);
    expect(error.retryable).toBe(false);
  });

  it('maps 403 to FORBIDDEN (non-retryable)', async () => {
    const error = await normalizeHttpError(mockResponse(403));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.status).toBe(403);
    expect(error.retryable).toBe(false);
  });

  it('maps 404 to NOT_FOUND (non-retryable)', async () => {
    const error = await normalizeHttpError(mockResponse(404));
    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.retryable).toBe(false);
  });

  it('maps 422 to UNPROCESSABLE (non-retryable)', async () => {
    const error = await normalizeHttpError(mockResponse(422));
    expect(error.code).toBe('UNPROCESSABLE');
    expect(error.status).toBe(422);
    expect(error.retryable).toBe(false);
  });

  it('maps 429 to RATE_LIMITED (retryable)', async () => {
    const error = await normalizeHttpError(mockResponse(429));
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.status).toBe(429);
    expect(error.retryable).toBe(true);
  });

  it('maps 503 to SERVER_ERROR (retryable)', async () => {
    const error = await normalizeHttpError(mockResponse(503));
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
  });

  it('extracts message from "message" field in response body', async () => {
    const error = await normalizeHttpError(
      mockResponse(400, { message: 'Custom error message' })
    );
    expect(error.message).toBe('Custom error message');
  });

  it('falls back to "detail" field for FastAPI errors', async () => {
    const error = await normalizeHttpError(
      mockResponse(400, { detail: 'Pydantic validation failed' })
    );
    expect(error.message).toBe('Pydantic validation failed');
  });

  it('uses default message when body has no message field', async () => {
    const error = await normalizeHttpError(mockResponse(500));
    expect(error.message).toBeTruthy();
    expect(error.message).not.toBe('');
  });

  // Validation details extraction
  it('extracts Pydantic field errors from 422 detail array', async () => {
    const body = {
      detail: [
        { loc: ['body', 'phone'], msg: 'field required', type: 'value_error' },
        { loc: ['body', 'amount'], msg: 'must be positive', type: 'value_error' },
      ],
    };
    const error = await normalizeHttpError(mockResponse(422, body));
    expect(error.details).toBeDefined();
    expect(error.details).toEqual({
      phone: 'field required',
      amount: 'must be positive',
    });
  });

  it('extracts flat error object from "errors" field', async () => {
    const body = {
      message: 'Validation failed',
      errors: { email: 'Invalid format', name: 'Too short' },
    };
    const error = await normalizeHttpError(mockResponse(400, body));
    expect(error.details).toBeDefined();
    expect(error.details).toEqual({ email: 'Invalid format', name: 'Too short' });
  });

  it('handles non-JSON response bodies gracefully', async () => {
    const response = new Response('Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
    const error = await normalizeHttpError(response);
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.status).toBe(500);
    expect(error.message).toBeTruthy();
  });
});

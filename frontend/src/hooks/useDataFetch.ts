/**
 * Generic data-fetching hook for the Synapse Reconciliation Engine.
 * Encapsulates the standard fetch-on-mount + loading/error/data state pattern.
 *
 * Handles:
 * - Automatic fetch on mount and when dependencies change
 * - Race condition prevention via stale-closure abort flag
 * - Clean error surfacing from ApiResult<T> discriminated union
 * - Manual refetch capability for retry/refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApiResult, ApiError } from '../lib/types';

interface DataFetchState<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
}

/**
 * Fetches data from an async service function and tracks loading/error/data states.
 *
 * @param fetchFn - Async function returning an ApiResult<T>
 * @param deps - Dependency array that triggers re-fetch when changed
 * @returns Object with data, isLoading, error, and refetch function
 *
 * @example
 * const { data, isLoading, error, refetch } = useDataFetch(
 *   () => invoiceService.fetchTransactions({ page, status }),
 *   [page, status]
 * );
 */
export function useDataFetch<T>(
  fetchFn: () => Promise<ApiResult<T>>,
  deps: unknown[]
): DataFetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<DataFetchState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  // Track the current fetch generation to prevent stale closures
  const generationRef = useRef(0);

  const executeFetch = useCallback(async () => {
    const currentGeneration = ++generationRef.current;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const result = await fetchFn();

    // Bail out if a newer fetch has been initiated
    if (currentGeneration !== generationRef.current) return;

    if (result.ok) {
      setState({ data: result.data, isLoading: false, error: null });
    } else {
      setState((prev) => ({ ...prev, isLoading: false, error: result.error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    executeFetch();
  }, [executeFetch]);

  return {
    ...state,
    refetch: executeFetch,
  };
}

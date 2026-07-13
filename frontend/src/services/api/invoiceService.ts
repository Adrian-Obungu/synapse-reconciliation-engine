/**
 * Transaction/invoice service for the Synapse Reconciliation Engine.
 * Handles ledger queries, individual transaction lookups, and
 * manual DLQ (Dead-Letter Queue) retry operations.
 */

import type {
  ApiResult,
  Transaction,
  PaginatedResponse,
  TransactionQueryParams,
} from '../../lib/types';
import { httpGet, httpPost } from './http';

export const invoiceService = {
  /**
   * Fetches a paginated list of transactions from the reconciliation ledger.
   * Supports filtering by status and search queries.
   * 
   * @param params - Optional query parameters (status, page, limit, search)
   */
  fetchTransactions(
    params?: TransactionQueryParams
  ): Promise<ApiResult<PaginatedResponse<Transaction>>> {
    const query = buildTransactionQuery(params);
    return httpGet<PaginatedResponse<Transaction>>(`/transactions${query}`);
  },

  /**
   * Fetches a single transaction by ID.
   * 
   * @param id - The transaction UUID
   */
  getTransactionById(id: string): Promise<ApiResult<Transaction>> {
    return httpGet<Transaction>(`/transactions/${id}`);
  },

  /**
   * Triggers a manual retry for a transaction in the Dead-Letter Queue.
   * The backend will re-attempt reconciliation with eTIMS/KRA.
   * 
   * @param id - The transaction UUID to retry
   * @returns Updated transaction with new status
   */
  retryTransaction(id: string): Promise<ApiResult<Transaction>> {
    return httpPost<Transaction>(`/transactions/${id}/retry`);
  },
};

/** Builds a URL query string from transaction query parameters. */
function buildTransactionQuery(params?: TransactionQueryParams): string {
  if (!params) return '';

  const parts: string[] = [];

  if (params.status) parts.push(`status=${params.status}`);
  if (params.page !== undefined) parts.push(`page=${params.page}`);
  if (params.limit !== undefined) parts.push(`limit=${params.limit}`);
  if (params.search) parts.push(`search=${encodeURIComponent(params.search)}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

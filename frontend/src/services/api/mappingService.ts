/**
 * KRA tax parameter mapping service for the Synapse Reconciliation Engine.
 * Handles CRUD operations for KRA mappings and bulk CSV import via
 * server-side processing (multipart/form-data upload).
 */

import type {
  ApiResult,
  KraMapping,
  PaginatedResponse,
  PaginationParams,
} from '../../lib/types';
import { httpGet, httpPost, httpPut, httpDelete, httpUpload } from './http';

/** Response shape for bulk CSV import operations. */
export interface BulkImportResult {
  imported: number;
  errors: string[];
}

export const mappingService = {
  /**
   * Fetches a paginated list of KRA mappings.
   * 
   * @param params - Optional pagination and search parameters
   */
  fetchMappings(
    params?: PaginationParams
  ): Promise<ApiResult<PaginatedResponse<KraMapping>>> {
    const query = buildQueryString(params);
    return httpGet<PaginatedResponse<KraMapping>>(`/mappings${query}`);
  },

  /**
   * Fetches a single KRA mapping by ID.
   * 
   * @param id - The mapping UUID
   */
  getMappingById(id: string): Promise<ApiResult<KraMapping>> {
    return httpGet<KraMapping>(`/mappings/${id}`);
  },

  /**
   * Creates a new KRA mapping entry.
   * 
   * @param data - The mapping data (excluding id, created_at, updated_at)
   */
  createMapping(
    data: Omit<KraMapping, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ApiResult<KraMapping>> {
    return httpPost<KraMapping>('/mappings', data);
  },

  /**
   * Updates an existing KRA mapping.
   * 
   * @param id - The mapping UUID
   * @param data - Partial mapping data to update
   */
  updateMapping(
    id: string,
    data: Partial<Omit<KraMapping, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<ApiResult<KraMapping>> {
    return httpPut<KraMapping>(`/mappings/${id}`, data);
  },

  /**
   * Deletes a KRA mapping by ID.
   * 
   * @param id - The mapping UUID
   */
  deleteMapping(id: string): Promise<ApiResult<void>> {
    return httpDelete<void>(`/mappings/${id}`);
  },

  /**
   * Uploads a CSV file for bulk KRA mapping import.
   * The file is sent as multipart/form-data — parsing and validation
   * are performed server-side by the FastAPI backend.
   * 
   * @param file - The CSV File object from an <input type="file"> element
   */
  uploadBulkCSV(file: File): Promise<ApiResult<BulkImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    return httpUpload<BulkImportResult>('/mappings/bulk', formData);
  },
};

/** Builds a URL query string from optional pagination parameters. */
function buildQueryString(params?: PaginationParams): string {
  if (!params) return '';

  const parts: string[] = [];

  if (params.page !== undefined) parts.push(`page=${params.page}`);
  if (params.limit !== undefined) parts.push(`limit=${params.limit}`);
  if (params.search) parts.push(`search=${encodeURIComponent(params.search)}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

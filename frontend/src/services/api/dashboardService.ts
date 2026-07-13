import type { ApiResult, DashboardSummary, Transaction } from '../../lib/types';
import { httpGet } from './http';

export const dashboardService = {
  fetchSummary(): Promise<ApiResult<DashboardSummary>> {
    return httpGet<DashboardSummary>('/dashboard/summary');
  },

  fetchRecentTransactions(): Promise<ApiResult<{ data: Transaction[] }>> {
    return httpGet<{ data: Transaction[] }>('/transactions?limit=10&page=1');
  },
};

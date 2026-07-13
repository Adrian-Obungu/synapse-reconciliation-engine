import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useDataFetch } from '../hooks/useDataFetch';
import { useToast } from '../hooks/useToast';
import { invoiceService } from '../services/api/invoiceService';
import { formatKES, formatRelativeDate, formatAbsoluteDate, formatKenyanPhone } from '../lib/format';
import { TRANSACTION_STATUS } from '../lib/constants';
import type { Transaction, TransactionStatus } from '../lib/types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TaxTypeBadge } from '../components/ui/TaxTypeBadge';
import { CopyableId } from '../components/ui/CopyableId';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorCard } from '../components/ui/ErrorCard';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/SkeletonTable';

type SortKey = 'amount' | 'created_at' | 'retry_count' | 'status';
type SortDirection = 'asc' | 'desc';

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  // URL Params
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const statusParam = searchParams.get('status') as TransactionStatus | null;
  const searchParam = searchParams.get('search') || '';

  // Local state for sorting & expansion
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  // Data Fetch
  const { data, isLoading, error, refetch } = useDataFetch(
    () =>
      invoiceService.fetchTransactions({
        page,
        limit,
        status: statusParam || undefined,
        search: searchParam || undefined,
      }),
    [page, limit, statusParam, searchParam]
  );

  // Optimistic Retry handler
  const handleRetry = useCallback(
    async (e: React.MouseEvent, tx: Transaction) => {
      e.stopPropagation(); // prevent row expansion toggle
      if (tx.status !== 'FAILED_DLQ' || retryingIds.has(tx.id)) return;

      // Optimistic update UI state
      setRetryingIds((prev) => new Set(prev).add(tx.id));

      const result = await invoiceService.retryTransaction(tx.id);

      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(tx.id);
        return next;
      });

      if (result.ok) {
        toast({
          type: 'success',
          message: 'Transaction successfully queued for retry.',
        });
        // We ideally update the local array here or refetch. Refetching is safer to get the exact new status and timestamps.
        refetch();
      } else {
        toast({
          type: 'error',
          message: `Retry failed: ${result.error.message}`,
        });
      }
    },
    [retryingIds, refetch, toast]
  );

  // URL Sync Handlers
  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParams({ status: e.target.value, page: '1' }); // Reset page on filter change
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParams({ search: e.target.value, page: '1' });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc'); // Default to desc when changing columns
    }
  };

  // Client-side sorting of current page
  const sortedTransactions = useMemo(() => {
    if (!data?.data) return [];
    return [...data.data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'status') {
        aVal = TRANSACTION_STATUS[a.status].label;
        bVal = TRANSACTION_STATUS[b.status].label;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  // View States
  if (error) {
    return (
      <div className="p-6 md:p-8 animate-fade-in">
        <ErrorCard error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="p-6 md:p-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold text-slate-50">Transaction Ledger</h2>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search phone, ID..."
                value={searchParam}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-3 py-2 bg-midnight-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusParam || ''}
              onChange={handleStatusChange}
              className="w-full sm:w-auto px-3 py-2 bg-midnight-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
            >
              <option value="">All Statuses</option>
              {Object.entries(TRANSACTION_STATUS).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ledger Table Container */}
        <div className="bg-surface rounded-xl border border-slate-700/50 flex flex-col min-h-0 overflow-hidden">
          {isLoading && !data ? (
            <SkeletonTable rows={10} cols={8} />
          ) : sortedTransactions.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              }
              title="No transactions found"
              description="Try adjusting your search or filter criteria."
              action={
                statusParam || searchParam
                  ? { label: 'Clear Filters', onClick: () => updateParams({ status: null, search: null }) }
                  : undefined
              }
            />
          ) : (
            <div className="flex-1 overflow-auto ledger-scroll">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-700/50 bg-slate-800 backdrop-blur-md bg-opacity-90">
                    <SortableHeader label="Status" sortKey="status" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th className="px-6 py-3 text-xs font-medium text-slate-400">ID</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400">Phone</th>
                    <SortableHeader label="Amount" sortKey="amount" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} className="text-right" />
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 hidden lg:table-cell">Tax Type</th>
                    <SortableHeader label="Created" sortKey="created_at" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Retries" sortKey="retry_count" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} className="hidden md:table-cell text-center" />
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sortedTransactions.map((tx) => {
                    const isRetrying = retryingIds.has(tx.id) || tx.status === 'RETRYING';
                    const isExpanded = expandedId === tx.id;

                    return (
                      <React.Fragment key={tx.id}>
                        <tr 
                          onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                          className={`hover:bg-slate-800/50 transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-800/30' : ''}`}
                        >
                          <td className="px-6 py-3">
                            <StatusBadge status={isRetrying ? 'RETRYING' : tx.status} />
                          </td>
                          <td className="px-6 py-3">
                            <CopyableId id={tx.id} />
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-300">
                            {formatKenyanPhone(tx.phone)}
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-300 text-right tabular-nums">
                            {formatKES(tx.amount)}
                          </td>
                          <td className="px-6 py-3 hidden lg:table-cell">
                            <TaxTypeBadge type={tx.tax_type} />
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-400" title={formatAbsoluteDate(tx.created_at)}>
                            {formatRelativeDate(tx.created_at)}
                          </td>
                          <td className="px-6 py-3 text-sm hidden md:table-cell text-center">
                            <span className={tx.retry_count > 0 ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                              {tx.retry_count}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            {tx.status === 'FAILED_DLQ' && (
                              <button
                                onClick={(e) => handleRetry(e, tx)}
                                disabled={isRetrying}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-slate-200 rounded-lg transition-colors"
                              >
                                {isRetrying ? (
                                  <div className="w-3.5 h-3.5 border-[1.5px] border-slate-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                  </svg>
                                )}
                                Retry
                              </button>
                            )}
                          </td>
                        </tr>
                        
                        {/* Expanded Details Row */}
                        <tr>
                          <td colSpan={8} className="p-0 border-none">
                            <div 
                              className="accordion-panel bg-midnight-950/30"
                              data-expanded={isExpanded}
                            >
                              <div className="p-6 border-b border-slate-700/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  <div>
                                    <span className="block text-xs font-medium text-slate-500 mb-1">Full Transaction ID</span>
                                    <span className="text-sm font-mono text-slate-300">{tx.id}</span>
                                  </div>
                                  <div>
                                    <span className="block text-xs font-medium text-slate-500 mb-1">eTIMS Receipt</span>
                                    <span className="text-sm text-slate-300">{tx.etims_receipt_number || 'Pending generation'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-xs font-medium text-slate-500 mb-1">Organization ID</span>
                                    <span className="text-sm font-mono text-slate-400">{tx.organization_id}</span>
                                  </div>
                                  
                                  <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg bg-surface/50 border border-slate-700/50">
                                    <div>
                                      <span className="block text-xs font-medium text-coral-500/80 mb-2">Last Error</span>
                                      {tx.last_error ? (
                                        <pre className="text-xs text-coral-400 font-mono whitespace-pre-wrap">{tx.last_error}</pre>
                                      ) : (
                                        <span className="text-sm text-slate-500">—</span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="block text-xs font-medium text-amber-500/80 mb-2">DLQ Reason</span>
                                      <span className="text-sm text-slate-300">{tx.dlq_reason || '—'}</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <span className="block text-xs font-medium text-slate-500 mb-1">Created At</span>
                                    <span className="text-sm text-slate-300">{formatAbsoluteDate(tx.created_at)}</span>
                                  </div>
                                  <div>
                                    <span className="block text-xs font-medium text-slate-500 mb-1">Last Updated</span>
                                    <span className="text-sm text-slate-300">{formatAbsoluteDate(tx.updated_at)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data && (
            <Pagination
              page={page}
              limit={limit}
              total={data.total}
              onPageChange={(p) => updateParams({ page: String(p) })}
              onLimitChange={(l) => updateParams({ limit: String(l), page: '1' })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable Header
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  direction,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;

  return (
    <th
      className={`px-6 py-3 text-xs font-medium text-slate-400 sort-header ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {label}
        <span className={`sort-arrow ${isActive ? 'active' : ''}`}>
          {isActive && direction === 'asc' ? '▲' : '▼'}
        </span>
      </div>
    </th>
  );
}

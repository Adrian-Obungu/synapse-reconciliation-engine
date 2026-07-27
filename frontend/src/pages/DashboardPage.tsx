import { useDataFetch } from '../hooks/useDataFetch';
import { dashboardService } from '../services/api/dashboardService';
import { formatKES, formatRelativeDate } from '../lib/format';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorCard } from '../components/ui/ErrorCard';
import { EmptyState } from '../components/ui/EmptyState';
import { useNavigate } from 'react-router';

export function DashboardPage() {
  const navigate = useNavigate();
  
  // Fetch summary metrics
  const summaryFetch = useDataFetch(
    () => dashboardService.fetchSummary(),
    []
  );

  // Fetch recent transactions
  const recentFetch = useDataFetch(
    () => dashboardService.fetchRecentTransactions(),
    []
  );

  const handleRetryAll = () => {
    summaryFetch.refetch();
    recentFetch.refetch();
  };

  // If either fails, show unified error
  if (summaryFetch.error || recentFetch.error) {
    return (
      <ErrorCard 
        error={summaryFetch.error || recentFetch.error!} 
        onRetry={handleRetryAll} 
      />
    );
  }

  const summary = summaryFetch.data;
  const recentData = recentFetch.data?.data;
  
  const isSummaryLoading = summaryFetch.isLoading || !summary;
  const isRecentLoading = recentFetch.isLoading || !recentData;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      
      {/* Metric Cards Row */}
      <section>
        <h2 className="text-lg font-semibold text-slate-50 mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Transactions */}
          <MetricCard
            title="Total Transactions"
            value={summary?.total}
            isLoading={isSummaryLoading}
            tone="slate"
          />
          
          {/* Reconciled */}
          <MetricCard
            title="Reconciled"
            value={summary?.reconciled}
            subtext={summary ? `(${(summary.reconciliation_rate * 100).toFixed(1)}%)` : undefined}
            isLoading={isSummaryLoading}
            tone="emerald"
          />
          
          {/* Pending / Retrying */}
          <MetricCard
            title="Pending & Retrying"
            value={summary ? summary.pending + summary.retrying : undefined}
            isLoading={isSummaryLoading}
            tone="amber"
          />
          
          {/* Failed (DLQ) */}
          <MetricCard
            title="Failed (DLQ)"
            value={summary?.failed_dlq}
            isLoading={isSummaryLoading}
            tone="coral"
          />
          
        </div>
      </section>

      {/* Recent Activity Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-50">Recent Activity</h2>
          <button 
            onClick={() => navigate('/transactions')}
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View all &rarr;
          </button>
        </div>

        <div className="bg-surface rounded-xl border border-slate-700/50 overflow-hidden">
          {isRecentLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-1/4 bg-slate-700/50 rounded-full shimmer" />
                  <div className="h-4 w-1/6 bg-slate-700/50 rounded-full shimmer" />
                  <div className="h-4 w-1/6 bg-slate-700/50 rounded-full shimmer" />
                  <div className="h-4 w-1/6 bg-slate-700/50 rounded-full shimmer" />
                </div>
              ))}
            </div>
          ) : recentData.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              }
              title="No recent transactions"
              description="Transactions will appear here once they are processed by the engine."
            />
          ) : (
            <div className="overflow-x-auto ledger-scroll">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/30">
                    <th className="px-6 py-3 text-xs font-medium text-slate-400">Status</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400">Phone</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 text-right">Amount</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {recentData.map((tx) => (
                    <tr 
                      key={tx.id} 
                      onClick={() => navigate(`/transactions?status=${tx.status}`)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-3">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-slate-300 group-hover:text-emerald-400 transition-colors">
                        {/* We don't have formatKenyanPhone returning in the table directly, we format it here if we want, or rely on raw phone */}
                        {tx.phone}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-300 text-right tabular-nums">
                        {formatKES(tx.amount)}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-400">
                        {formatRelativeDate(tx.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Card Component
// ---------------------------------------------------------------------------

interface MetricCardProps {
  title: string;
  value?: number;
  subtext?: string;
  isLoading: boolean;
  tone: 'slate' | 'emerald' | 'amber' | 'coral';
}

function MetricCard({ title, value, subtext, isLoading, tone }: MetricCardProps) {
  let dotClass = 'bg-slate-500 shadow-slate-500/50';
  if (tone === 'emerald') dotClass = 'bg-emerald-500 shadow-emerald-500/50';
  if (tone === 'amber') dotClass = 'bg-amber-500 shadow-amber-500/50';
  if (tone === 'coral') dotClass = 'bg-coral-500 shadow-coral-500/50';

  return (
    <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${dotClass}`} />
        <span className="text-sm font-medium text-slate-400">{title}</span>
      </div>
      
      <div className="mt-auto">
        {isLoading ? (
          <div className="h-8 w-24 bg-slate-700/50 rounded shimmer" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-50 tabular-nums">
              {new Intl.NumberFormat('en-US').format(value ?? 0)}
            </span>
            {subtext && (
              <span className="text-xs font-medium text-emerald-400">
                {subtext}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

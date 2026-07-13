import { TRANSACTION_STATUS } from '../../lib/constants';
import type { TransactionStatus } from '../../lib/types';

interface StatusBadgeProps {
  status: TransactionStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = TRANSACTION_STATUS[status];
  
  let colorClasses = '';
  switch (config.tone) {
    case 'success':
      colorClasses = 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20';
      break;
    case 'warning':
      colorClasses = 'bg-amber-400/15 text-amber-400 ring-amber-400/20';
      break;
    case 'destructive':
      colorClasses = 'bg-coral-500/15 text-coral-500 ring-coral-500/20';
      break;
    default:
      colorClasses = 'bg-slate-500/15 text-slate-400 ring-slate-500/20';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ring-inset ${colorClasses} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}

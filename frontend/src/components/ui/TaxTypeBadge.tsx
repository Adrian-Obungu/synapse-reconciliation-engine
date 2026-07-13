import { TAX_TYPES } from '../../lib/constants';
import type { TaxType } from '../../lib/types';

interface TaxTypeBadgeProps {
  type: TaxType;
}

export function TaxTypeBadge({ type }: TaxTypeBadgeProps) {
  const config = TAX_TYPES[type];

  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-600 bg-slate-800/50">
      {config.label}
    </span>
  );
}

import type { ApiError } from '../../lib/types';

interface ErrorCardProps {
  error: ApiError;
  onRetry: () => void;
}

export function ErrorCard({ error, onRetry }: ErrorCardProps) {
  return (
    <div className="flex items-center justify-center w-full py-12 animate-fade-in">
      <div className="w-full max-w-md bg-surface rounded-xl border border-slate-700/50 border-l-4 border-l-coral-500 p-6 shadow-xl">
        <div className="flex items-start gap-4 mb-5">
          <div className="shrink-0 mt-0.5 text-coral-500">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50 mb-1">Failed to load data</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {error.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pl-10">
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

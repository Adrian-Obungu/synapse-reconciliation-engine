/**
 * Toast notification system for the Synapse Reconciliation Engine.
 *
 * Provides a context-based multi-stack FIFO toast container positioned
 * at the bottom-right of the viewport. Supports success, error, and
 * info variants mapped to our design token palette.
 *
 * Max 3 stacked toasts. Auto-dismiss after configurable duration (default 4s).
 */

import {
  createContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
}

export interface ToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4000;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Start exit animation
    setDismissing((prev) => new Set(prev).add(id));
    // Remove after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
    // Clean up timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = options.duration ?? DEFAULT_DURATION;

      const newToast: ToastItem = {
        id,
        type: options.type,
        message: options.message,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const next = [...prev, newToast];
        // FIFO eviction — dismiss oldest if exceeding max
        if (next.length > MAX_TOASTS) {
          const oldest = next[0];
          dismiss(oldest.id);
        }
        return next.slice(-MAX_TOASTS);
      });

      // Auto-dismiss timer
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  const contextValue: ToastContextValue = { toast, dismiss };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast container — fixed bottom-right */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
          aria-live="polite"
          aria-label="Notifications"
        >
          {toasts.map((t) => (
            <ToastCard
              key={t.id}
              toast={t}
              isDismissing={dismissing.has(t.id)}
              onDismiss={() => dismiss(t.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Toast Card
// ---------------------------------------------------------------------------

const TONE_CLASSES: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: {
    border: 'border-l-emerald-500',
    icon: 'text-emerald-400',
    bg: 'bg-surface-elevated',
  },
  error: {
    border: 'border-l-coral-500',
    icon: 'text-coral-500',
    bg: 'bg-surface-elevated',
  },
  info: {
    border: 'border-l-slate-400',
    icon: 'text-slate-400',
    bg: 'bg-surface-elevated',
  },
};

function ToastCard({
  toast,
  isDismissing,
  onDismiss,
}: {
  toast: ToastItem;
  isDismissing: boolean;
  onDismiss: () => void;
}) {
  const tones = TONE_CLASSES[toast.type];

  return (
    <div
      className={`
        pointer-events-auto w-80 rounded-lg border border-slate-700/50 border-l-4
        ${tones.border} ${tones.bg} p-4 shadow-xl
        ${isDismissing ? 'animate-toast-out' : 'animate-toast-in'}
      `}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 mt-0.5 ${tones.icon}`}>
          {toast.type === 'success' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
        </div>

        {/* Message */}
        <p className="flex-1 text-sm text-slate-200 leading-snug">
          {toast.message}
        </p>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Dismiss notification"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="mt-3 h-0.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            toast.type === 'success'
              ? 'bg-emerald-500'
              : toast.type === 'error'
                ? 'bg-coral-500'
                : 'bg-slate-400'
          }`}
          style={{
            animation: `toast-progress ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Two-tier React error boundary system for the Synapse Reconciliation Engine.
 *
 * RootErrorBoundary: Wraps the entire app. Catches catastrophic crashes.
 *   Shows a full-page error with "Reload Application" button.
 *
 * PageErrorBoundary: Wraps individual route content inside the app shell.
 *   Catches page-specific crashes without killing the sidebar/header.
 *   Shows an inline error card with "Retry" button that re-mounts the page.
 */

import { Component, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Root Error Boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Root-level error boundary. Wraps the entire application.
 * On crash: shows a full-page error screen with reload button.
 */
export class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-midnight-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface rounded-xl border border-slate-700/50 p-8 text-center">
            {/* Error icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-coral-500/10 flex items-center justify-center mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-coral-500">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-slate-50 mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              The application encountered an unexpected error. Please reload to continue.
            </p>

            {/* Error details (dev only) */}
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-coral-500/80 bg-midnight-950 rounded-lg p-3 mb-6 text-left overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Page Error Boundary
// ---------------------------------------------------------------------------

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorKey: number;
}

/**
 * Page-level error boundary. Wraps individual route content.
 * On crash: shows an inline error card while sidebar/header remain interactive.
 * The "Retry" button re-mounts the page component via key reset.
 */
export class PageErrorBoundary extends Component<
  { children: ReactNode },
  PageErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<PageErrorBoundaryState> {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorKey: prev.errorKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
          <div className="max-w-sm w-full bg-surface rounded-xl border border-coral-500/30 p-6 text-center">
            {/* Error icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-coral-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-coral-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h2 className="text-lg font-semibold text-slate-50 mb-1">
              Page error
            </h2>
            <p className="text-slate-400 text-sm mb-5">
              This page encountered an error. Other pages may still work.
            </p>

            {/* Error message (dev only) */}
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-coral-500/70 bg-midnight-950 rounded-lg p-3 mb-5 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
              <a
                href="/dashboard"
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={this.state.errorKey}>
        {this.props.children}
      </div>
    );
  }
}

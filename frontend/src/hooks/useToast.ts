/**
 * Toast action hook for the Synapse Reconciliation Engine.
 * Consumes the ToastContext and provides a clean API for triggering
 * success, error, and info notifications from any component.
 */

import { useContext } from 'react';
import { ToastContext } from '../components/toast/ToastContext';
import type { ToastContextValue } from '../components/toast/ToastContext';

/**
 * Hook to access the toast notification system.
 * Must be called within a <ToastProvider> context.
 *
 * @example
 * const { toast } = useToast();
 * toast({ type: 'success', message: 'Transaction retried successfully' });
 * toast({ type: 'error', message: 'Failed to delete mapping', duration: 6000 });
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error(
      '[Synapse] useToast must be used within a <ToastProvider>. ' +
      'Ensure your component tree is wrapped with <ToastProvider>.'
    );
  }
  return context;
}

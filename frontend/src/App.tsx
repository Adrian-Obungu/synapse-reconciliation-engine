import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { RootErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/toast/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { useAuthStore } from './stores/authStore';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { MappingsPage } from './pages/MappingsPage';

export function App() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  // Initialize auth state on app mount
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return unsubscribe;
  }, [initializeAuth]);

  return (
    <RootErrorBoundary>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/mappings" element={<MappingsPage />} />
            </Route>
          </Route>
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ToastProvider>
    </RootErrorBoundary>
  );
}

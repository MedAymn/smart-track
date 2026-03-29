import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import AuthScreen from './components/AuthScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

import React, { lazy, Suspense } from 'react';

// Lazy-loaded page chunks — each page is a separate JS bundle loaded on first visit
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Inventory    = lazy(() => import('./pages/Inventory'));
const Debtors      = lazy(() => import('./pages/Debtors'));
const Clients      = lazy(() => import('./pages/Clients'));
const Suppliers    = lazy(() => import('./pages/Suppliers'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Statistics   = lazy(() => import('./pages/Statistics'));
const Repairs      = lazy(() => import('./pages/Repairs'));
const Activity     = lazy(() => import('./pages/Activity'));
const Staff        = lazy(() => import('./pages/Staff'));
const Tasks        = lazy(() => import('./pages/Tasks'));
const Settings     = lazy(() => import('./pages/Settings'));

const PageFallback = () => {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '0.9rem', gap: '0.5rem' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      {t('common.loading')}
    </div>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, errorInfo: React.ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#ef4444', backgroundColor: '#fee2e2', borderRadius: '8px', margin: '2rem', fontFamily: 'monospace' }}>
          <h2 style={{marginTop: 0}}>Une erreur est survenue au rendu de la page.</h2>
          <p>Détails de l'erreur :</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fef2f2', padding: '1rem', border: '1px solid #fca5a5' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}>Actualiser</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppContent = () => {

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="inventory" element={<Suspense fallback={<PageFallback />}><Inventory /></Suspense>} />
          <Route path="debtors" element={<Suspense fallback={<PageFallback />}><Debtors /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={<PageFallback />}><Clients /></Suspense>} />
          <Route path="suppliers" element={<Suspense fallback={<PageFallback />}><Suppliers /></Suspense>} />
          <Route path="transactions" element={<Suspense fallback={<PageFallback />}><Transactions /></Suspense>} />
          <Route path="statistics" element={<Suspense fallback={<PageFallback />}><Statistics /></Suspense>} />
          <Route path="repairs" element={<Suspense fallback={<PageFallback />}><Repairs /></Suspense>} />
          <Route path="activity" element={<Suspense fallback={<PageFallback />}><Activity /></Suspense>} />
          <Route path="staff" element={<Suspense fallback={<PageFallback />}><Staff /></Suspense>} />
          <Route path="tasks" element={<Suspense fallback={<PageFallback />}><Tasks /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

const AppRouter = () => {
  const { session, profile, isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
        {t('common.loading')}
      </div>
    );
  }

  // Si on est connecté mais on attend la fin du fetch profile (la sécurité avant de rendre AppContent)
  if (session && !profile) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
          {t('common.loading_profile')}
        </div>
      );
  }

  if (!session) {
    return <AuthScreen onUnlock={() => {}} />;
  }

  return <AppContent />;
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <ErrorBoundary>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </ErrorBoundary>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

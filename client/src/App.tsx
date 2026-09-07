import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { AllRoutes } from './routes/allRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  const fetchLowStockCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/alerts/count', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLowStockCount(data.count ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch low stock count', err);
    }
  }, [user]);

  useEffect(() => {
    fetchLowStockCount();
    // Poll count periodically (every 30 seconds)
    const interval = setInterval(fetchLowStockCount, 30000);
    return () => clearInterval(interval);
  }, [fetchLowStockCount]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading StockPulse...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar lowStockCount={lowStockCount} />

      <main style={{ flex: 1, minWidth: 0, width: '100%', overflowX: 'hidden' }}>
        <ErrorBoundary key={location.pathname} fallbackTab={() => navigate('/dashboard')}>
          <AllRoutes onRefreshBadge={fetchLowStockCount} />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

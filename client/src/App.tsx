import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { LocationsPage } from './pages/LocationsPage';
import { ItemsPage } from './pages/ItemsPage';
import { MovementsPage } from './pages/MovementsPage';
import { ImportExportPage } from './pages/ImportExportPage';
import { AlertsPage } from './pages/AlertsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
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
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} lowStockCount={lowStockCount} />

      <main style={{ flex: 1, minWidth: 0, width: '100%', overflowX: 'hidden' }}>
        <ErrorBoundary key={currentTab} fallbackTab={setCurrentTab}>
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigateToItems={() => setCurrentTab('items')}
              onNavigateToAlerts={() => setCurrentTab('alerts')}
              onNavigateToMovements={() => setCurrentTab('movements')}
              onNavigateToLocations={() => setCurrentTab('locations')}
            />
          )}

          {currentTab === 'items' && <ItemsPage />}
          {currentTab === 'locations' && <LocationsPage />}
          {currentTab === 'movements' && <MovementsPage />}
          {currentTab === 'import-export' && <ImportExportPage />}
          {currentTab === 'alerts' && (
            <AlertsPage 
              onNavigateToMovements={() => setCurrentTab('movements')} 
              onRefreshBadge={fetchLowStockCount} 
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

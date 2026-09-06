import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { LocationsPage } from './pages/LocationsPage';
import { ItemsPage } from './pages/ItemsPage';
import { MovementsPage } from './pages/MovementsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutDashboard, FileUp, Bell } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('items');

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
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} lowStockCount={0} />

      <main style={{ flex: 1 }}>
        <ErrorBoundary key={currentTab} fallbackTab={setCurrentTab}>
          {currentTab === 'dashboard' && (
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <div className="glass-panel" style={{ padding: '3rem', maxWidth: 600, margin: '0 auto' }}>
                <LayoutDashboard size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Operational Dashboard</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  Operational KPI metrics, inventory valuation breakdown, and stock movement velocity trends.
                </p>
                <button onClick={() => setCurrentTab('items')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                  View Inventory Catalog
                </button>
              </div>
            </div>
          )}

          {currentTab === 'items' && <ItemsPage />}
          {currentTab === 'locations' && <LocationsPage />}
          {currentTab === 'movements' && <MovementsPage />}

          {currentTab === 'import-export' && (
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <div className="glass-panel" style={{ padding: '3rem', maxWidth: 600, margin: '0 auto' }}>
                <FileUp size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Bulk CSV Import & Export</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  Bulk import and export inventory items and receipts via CSV format with row-level validation.
                </p>
              </div>
            </div>
          )}

          {currentTab === 'alerts' && (
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <div className="glass-panel" style={{ padding: '3rem', maxWidth: 600, margin: '0 auto' }}>
                <Bell size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Low-Stock Alerts</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  Threshold alerts for low stock levels with automated notifications and re-arming triggers.
                </p>
              </div>
            </div>
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

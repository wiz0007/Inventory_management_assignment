import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { LocationsPage } from './pages/LocationsPage';
import { Boxes, ArrowLeftRight, LayoutDashboard, FileUp, Bell } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('locations');

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
        {currentTab === 'locations' && <LocationsPage />}

        {currentTab === 'dashboard' && (
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div className="glass-panel" style={{ padding: '3rem', maxWidth: 600, margin: '0 auto' }}>
              <LayoutDashboard size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Operational Dashboard</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                Headline KPI cards, breakdown charts by location/category, and 8-week movement trends will be populated here in Sprint 6.
              </p>
              <button onClick={() => setCurrentTab('locations')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                View Locations & Staff
              </button>
            </div>
          </div>
        )}

        {currentTab === 'items' && (
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div className="glass-panel" style={{ padding: '3rem', maxWidth: 600, margin: '0 auto' }}>
              <Boxes size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Inventory Catalog</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                Product catalog, categories, archiving, and audit change timeline are coming up in Sprint 2!
              </p>
            </div>
          </div>
        )}

        {currentTab === 'movements' && (
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div className="glass-panel" style={{ padding: '3rem', maxWidth: 600, margin: '0 auto' }}>
              <ArrowLeftRight size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Append-Only Stock Ledger</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                Receipts, issues, atomic transfers, and adjustments are coming up in Sprint 3!
              </p>
            </div>
          </div>
        )}

        {currentTab === 'import-export' && (
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div className="glass-panel" style={{ padding: '3rem', maxWidth: 600, margin: '0 auto' }}>
              <FileUp size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Bulk CSV Import & Export</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                Fault-tolerant item and receipt CSV imports with per-row failure isolation coming in Sprint 5!
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
                Real-time low stock monitoring with dismissal and re-arming engine coming in Sprint 5!
              </p>
            </div>
          </div>
        )}
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

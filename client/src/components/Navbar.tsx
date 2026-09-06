import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Boxes, 
  MapPin, 
  ArrowLeftRight, 
  LayoutDashboard, 
  FileUp, 
  Bell, 
  LogOut, 
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  lowStockCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, lowStockCount = 0 }) => {
  const { user, logout, login } = useAuth();
  const [showSwitchMenu, setShowSwitchMenu] = React.useState(false);

  const demoAccounts = [
    { name: 'Elena Rostova', role: 'MANAGER', email: 'manager@distributor.com', pass: 'Manager123!', label: 'Manager (Full Global Access)' },
    { name: 'Marcus Vance', role: 'STAFF', email: 'staff1@distributor.com', pass: 'Staff123!', label: 'Staff 1 (Main & North Depot)' },
    { name: 'Sarah Chen', role: 'STAFF', email: 'staff2@distributor.com', pass: 'Staff123!', label: 'Staff 2 (Downtown Retail Only)' },
  ];

  const handleQuickSwitch = async (email: string, pass: string) => {
    setShowSwitchMenu(false);
    await login(email, pass);
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 13, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.75rem 1.5rem'
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setCurrentTab('dashboard')}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-glow)'
          }}>
            <Boxes size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              StockPulse
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
              Audit Stock Ledger
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button 
            onClick={() => setCurrentTab('dashboard')} 
            className={`btn ${currentTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>

          <button 
            onClick={() => setCurrentTab('items')} 
            className={`btn ${currentTab === 'items' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
          >
            <Boxes size={16} />
            Inventory
          </button>

          <button 
            onClick={() => setCurrentTab('movements')} 
            className={`btn ${currentTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
          >
            <ArrowLeftRight size={16} />
            Ledger & Movements
          </button>

          <button 
            onClick={() => setCurrentTab('locations')} 
            className={`btn ${currentTab === 'locations' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
          >
            <MapPin size={16} />
            Locations & Staff
          </button>

          <button 
            onClick={() => setCurrentTab('import-export')} 
            className={`btn ${currentTab === 'import-export' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
          >
            <FileUp size={16} />
            CSV Import/Export
          </button>

          <button 
            onClick={() => setCurrentTab('alerts')} 
            className={`btn ${currentTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem', position: 'relative' }}
          >
            <Bell size={16} />
            Low Stock
            {lowStockCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '9999px',
                padding: '0.1rem 0.4rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                marginLeft: '0.35rem'
              }}>
                {lowStockCount}
              </span>
            )}
          </button>
        </nav>

        {/* User Profile & Demo Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '0.4rem 0.8rem',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.825rem' }}>{user.name}</span>
                    <span className={user.role === 'MANAGER' ? 'badge badge-manager' : 'badge badge-staff'}>
                      {user.role}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {user.role === 'MANAGER' 
                      ? '⚡ Global Manager Access'
                      : `📍 Assigned: ${user.assignedLocations.map(l => l.code).join(', ') || 'None'}`
                    }
                  </div>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" />
              </button>

              {/* Fast Switch Dropdown */}
              {showSwitchMenu && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '115%',
                  width: 310,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                  padding: '0.6rem',
                  zIndex: 100,
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.3rem 0.5rem', fontWeight: 700 }}>
                    Quick Role Switcher (Review Demo)
                  </div>
                  {demoAccounts.map(acc => (
                    <div 
                      key={acc.email} 
                      onClick={() => handleQuickSwitch(acc.email, acc.pass)}
                      style={{
                        padding: '0.5rem 0.6rem',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: user.email === acc.email ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        marginBottom: '0.25rem',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = user.email === acc.email ? 'rgba(99, 102, 241, 0.15)' : 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>{acc.name}</span>
                        <span className={acc.role === 'MANAGER' ? 'badge badge-manager' : 'badge badge-staff'}>
                          {acc.role}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{acc.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button 
            onClick={logout} 
            className="btn btn-secondary" 
            title="Log out"
            style={{ padding: '0.5rem', borderRadius: 8 }}
          >
            <LogOut size={16} />
          </button>
        </div>

      </div>
    </header>
  );
};

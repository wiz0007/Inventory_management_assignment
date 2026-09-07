import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Boxes, 
  MapPin, 
  ArrowLeftRight, 
  LayoutDashboard, 
  FileUp, 
  Bell, 
  LogOut, 
  ChevronDown, 
  Menu, 
  X 
} from 'lucide-react';
import styles from './Navbar.module.css';

interface NavbarProps {
  currentTab?: string;
  setCurrentTab?: (tab: string) => void;
  lowStockCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, lowStockCount = 0 }) => {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const switchMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showSwitchMenu) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (switchMenuRef.current && !switchMenuRef.current.contains(event.target as Node)) {
        setShowSwitchMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSwitchMenu]);

  // Keyboard Escape listener for dropdown and mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSwitchMenu(false);
        setMobileMenuOpen(false);
      }
    };

    if (showSwitchMenu || mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showSwitchMenu, mobileMenuOpen]);

  const demoAccounts = [
    { name: 'Elena Rostova', role: 'MANAGER', email: 'manager@distributor.com', pass: 'Manager123!', label: 'Manager (Full Global Access)' },
    { name: 'Marcus Vance', role: 'STAFF', email: 'staff1@distributor.com', pass: 'Staff123!', label: 'Staff 1 (Main & North Depot)' },
    { name: 'Sarah Chen', role: 'STAFF', email: 'staff2@distributor.com', pass: 'Staff123!', label: 'Staff 2 (Downtown Retail Only)' },
  ];

  const handleQuickSwitch = async (email: string, pass: string) => {
    setShowSwitchMenu(false);
    setMobileMenuOpen(false);
    await login(email, pass);
  };

  const navItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'items', path: '/items', label: 'Inventory', icon: Boxes },
    { id: 'movements', path: '/movements', label: 'Ledger', icon: ArrowLeftRight },
    { id: 'locations', path: '/locations', label: 'Locations', icon: MapPin },
    { id: 'import-export', path: '/import-export', label: 'CSV Data', icon: FileUp },
    { id: 'alerts', path: '/alerts', label: 'Low Stock', icon: Bell, badge: lowStockCount },
  ];

  const handleNavClick = (path: string, id: string) => {
    navigate(path);
    if (setCurrentTab) setCurrentTab(id);
    setMobileMenuOpen(false);
  };

  const isItemActive = (item: typeof navItems[0]) => {
    if (location.pathname === item.path) return true;
    if (item.id === 'dashboard' && (location.pathname === '/' || location.pathname === '')) return true;
    if (currentTab === item.id) return true;
    return false;
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 13, 20, 0.9)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.75rem 1rem'
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        
        {/* Brand Logo */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flexShrink: 0 }} 
          onClick={() => handleNavClick('/dashboard', 'dashboard')}
        >
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
            <div className={styles.logoTitle} style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              StockPulse
            </div>
            <div className={styles.logoSubtitle} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
              Audit Stock Ledger
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Hidden on screens <= 1024px) */}
        <nav className={styles.desktopTabs} style={{ alignItems: 'center', gap: '0.35rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            return (
              <button 
                key={item.id}
                onClick={() => handleNavClick(item.path, item.id)} 
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.825rem', whiteSpace: 'nowrap' }}
              >
                <Icon size={16} />
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '9999px',
                    padding: '0.1rem 0.4rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    marginLeft: '0.35rem'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop User Profile & Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {user && (
            <div ref={switchMenuRef} className={styles.desktopProfile} style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span className="nav-user-name" style={{ fontWeight: 600, fontSize: '0.8rem', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </span>
                    <span className={user.role === 'MANAGER' ? 'badge badge-manager' : 'badge badge-staff'}>
                      {user.role}
                    </span>
                  </div>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </button>

              {/* Fast Switch Dropdown */}
              {showSwitchMenu && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '120%',
                  width: 280,
                  maxWidth: '90vw',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
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

          {/* Desktop Logout Button (Hidden on <= 1024px, drawer has Sign Out) */}
          <button 
            onClick={logout} 
            className={`btn btn-secondary ${styles.desktopLogout}`} 
            title="Log out"
            style={{ padding: '0.45rem 0.65rem', borderRadius: 8 }}
          >
            <LogOut size={16} />
          </button>

          {/* Mobile Hamburger Toggle Button (Shown on <= 1024px) */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`btn btn-secondary ${styles.mobileToggle}`}
            aria-label="Toggle navigation menu"
            style={{ padding: '0.45rem 0.65rem', borderRadius: 8 }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Navigation Menu (Rendered on <= 1024px when open) */}
      {mobileMenuOpen && (
        <div 
          className={`glass-panel ${styles.mobileMenu} ${styles.mobileMenuAnimated}`} 
          style={{
            marginTop: '0.75rem',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            borderTop: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Active User Card on Mobile */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              marginBottom: '0.25rem'
            }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user.email}</div>
              </div>
              <span className={user.role === 'MANAGER' ? 'badge badge-manager' : 'badge badge-staff'}>
                {user.role}
              </span>
            </div>
          )}

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, paddingLeft: '0.5rem', marginBottom: '0.25rem' }}>
            Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            return (
              <button 
                key={item.id}
                onClick={() => handleNavClick(item.path, item.id)} 
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  justifyContent: 'flex-start', 
                  width: '100%', 
                  padding: '0.65rem 1rem', 
                  fontSize: '0.9rem',
                  gap: '0.75rem' 
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '9999px',
                    padding: '0.1rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    marginLeft: 'auto'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, paddingLeft: '0.5rem', marginBottom: '0.5rem' }}>
              Switch Demo Role (Reviewer)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => handleQuickSwitch(acc.email, acc.pass)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: user?.email === acc.email ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{acc.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{acc.label}</div>
                  </div>
                  <span className={acc.role === 'MANAGER' ? 'badge badge-manager' : 'badge badge-staff'}>
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setMobileMenuOpen(false); logout(); }}
            className="btn btn-danger"
            style={{ width: '100%', marginTop: '0.5rem', gap: '0.5rem' }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
};

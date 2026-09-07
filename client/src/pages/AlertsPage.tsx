import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  EyeOff, 
  RefreshCw, 
  TrendingDown, 
  ShieldAlert,
  ArrowLeftRight
} from 'lucide-react';
import styles from './AlertsPage.module.css';

export interface AlertItem {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  uom: string;
  reorderLevel: number;
  totalOnHand: number;
  deficit: number;
  category: {
    id: string;
    name: string;
  } | null;
  isDismissed: boolean;
  isReArmed: boolean;
  reArmedAt?: string | null;
  dismissedAt?: string | null;
  dismissedByName?: string | null;
  dismissal?: {
    dismissedAt: string;
    quantityAtDismissal: number;
    user: {
      name: string;
      email: string;
    };
  } | null;
}

interface AlertsPageProps {
  onNavigateToMovements?: () => void;
  onRefreshBadge?: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ onNavigateToMovements, onRefreshBadge }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'dismissed' | 'all'>('active');
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/alerts/low-stock?includeDismissed=true', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to load alerts: HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = data.alerts || data.items || [];
      setAlerts(list);
      if (onRefreshBadge) {
        onRefreshBadge();
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleDismissAlert = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Dismiss low-stock alert for "${itemName}"? The alert will remain silenced until stock rises above reorder level and falls back.`)) {
      return;
    }

    try {
      setDismissingId(itemId);
      const res = await fetch(`/api/alerts/dismiss/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to dismiss alert');
      }

      await fetchAlerts();
    } catch (err: any) {
      alert(`Dismissal Error: ${err.message}`);
    } finally {
      setDismissingId(null);
    }
  };

  const isManager = user?.role === 'MANAGER';

  // Filtered lists
  const activeAlerts = alerts.filter((a) => !a.isDismissed);
  const dismissedAlerts = alerts.filter((a) => a.isDismissed);
  const reArmedAlerts = alerts.filter((a) => a.isReArmed);

  const displayedAlerts = 
    filter === 'active' 
      ? activeAlerts 
      : filter === 'dismissed' 
      ? dismissedAlerts 
      : alerts;

  // Aggregate stats
  const totalDeficitUnits = activeAlerts.reduce((sum, a) => sum + Math.max(0, a.deficit), 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <Bell size={28} color="#ef4444" />
            <span>Low-Stock Alerts & Threshold Monitor</span>
          </h1>
          <p className={styles.subtitle}>
            Real-time audit of inventory items where company-wide derived on-hand balances fall at or below safety reorder thresholds. Includes an automated re-arming state machine.
          </p>
        </div>

        <button onClick={fetchAlerts} disabled={loading} className={styles.refreshBtn}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Live Alerts</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <AlertTriangle size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue} style={{ color: activeAlerts.length > 0 ? '#f87171' : '#34d399' }}>
              {activeAlerts.length}
            </div>
            <div className={styles.statLabel}>
              <span className={styles.statLabelDesktop}>Active Low-Stock Alerts</span>
              <span className={styles.statLabelMobile}>Active Alerts</span>
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <RotateCcw size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue} style={{ color: '#c084fc' }}>
              {reArmedAlerts.length}
            </div>
            <div className={styles.statLabel}>
              <span className={styles.statLabelDesktop}>Re-Armed Alerts (State Machine)</span>
              <span className={styles.statLabelMobile}>Re-Armed</span>
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <TrendingDown size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue} style={{ color: '#fbbf24' }}>
              {totalDeficitUnits.toLocaleString()}
            </div>
            <div className={styles.statLabel}>
              <span className={styles.statLabelDesktop}>Total Deficit Units</span>
              <span className={styles.statLabelMobile}>Deficit Units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs / Mobile Dropdown */}
      <div className={styles.filterBar}>
        {/* Desktop / Tablet Segmented Tabs */}
        <div className={styles.desktopFilterTabs}>
          <button
            onClick={() => setFilter('active')}
            className={`${styles.filterTabBtn} ${filter === 'active' ? styles.filterTabBtnActive : ''}`}
          >
            <span>Active Alerts</span>
            <span 
              className={styles.filterTabBadge}
              style={{ background: activeAlerts.length > 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.1)', color: '#fff' }}
            >
              {activeAlerts.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('dismissed')}
            className={`${styles.filterTabBtn} ${filter === 'dismissed' ? styles.filterTabBtnActive : ''}`}
          >
            <span>Dismissed by Manager</span>
            <span 
              className={styles.filterTabBadge}
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}
            >
              {dismissedAlerts.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`${styles.filterTabBtn} ${filter === 'all' ? styles.filterTabBtnActive : ''}`}
          >
            <span>All Monitored ({alerts.length})</span>
          </button>
        </div>

        {/* Mobile Dropdown Selector (<= 640px) */}
        <div className={styles.mobileFilterSelectWrapper}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'active' | 'dismissed' | 'all')}
            className={styles.mobileFilterSelect}
            aria-label="Filter alerts view"
          >
            <option value="active">Active Alerts ({activeAlerts.length})</option>
            <option value="dismissed">Dismissed by Manager ({dismissedAlerts.length})</option>
            <option value="all">All Monitored ({alerts.length})</option>
          </select>
        </div>

        {!isManager && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
            <ShieldAlert size={14} />
            <span>Alert dismissal requires Manager privileges</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 10,
          color: '#f87171',
          marginBottom: '1.5rem',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && alerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
          <div>Evaluating real-time stock balances across all warehouse locations...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedAlerts.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <CheckCircle2 size={28} />
          </div>
          <div className={styles.emptyTitle}>
            {filter === 'active' ? 'All Stock Levels Healthy' : 'No Alerts in this View'}
          </div>
          <p className={styles.emptyDesc}>
            {filter === 'active' 
              ? 'Every active inventory item currently maintains on-hand stock strictly above its configured reorder threshold.'
              : 'There are currently no items matching the selected alert state filter.'}
          </p>
        </div>
      )}

      {/* Alerts Cards List */}
      <div className={styles.alertList}>
        {displayedAlerts.map((item) => {
          const isCritical = item.totalOnHand === 0;
          const pct = item.reorderLevel > 0 
            ? Math.min(100, Math.round((item.totalOnHand / item.reorderLevel) * 100))
            : 0;

          let cardModifier = styles.alertCardWarning;
          if (item.isDismissed) {
            cardModifier = styles.alertCardDismissed;
          } else if (item.isReArmed) {
            cardModifier = styles.alertCardReArmed;
          } else if (isCritical) {
            cardModifier = styles.alertCardCritical;
          }

          return (
            <div key={item.id} className={`${styles.alertCard} ${cardModifier}`}>
              <div className={styles.cardHeader}>
                <div className={styles.itemTitleGroup}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemSku}>{item.sku}</span>
                  {item.category && (
                    <span className={styles.categoryPill}>{item.category.name}</span>
                  )}
                </div>

                <div className={styles.statusBadges}>
                  {item.isReArmed && (
                    <span className={styles.reArmedBadge} title="Alert re-armed automatically: stock recovered above threshold after dismissal, and later fell back.">
                      <RotateCcw size={12} />
                      RE-ARMED ALERT
                    </span>
                  )}

                  {item.isDismissed ? (
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                      DISMISSED
                    </span>
                  ) : isCritical ? (
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                      CRITICAL DEPLETION (0 ON-HAND)
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                      LOW STOCK ({item.deficit} {item.uom} DEFICIT)
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.cardBody}>
                {/* Stock Metrics & Progress Bar */}
                <div className={styles.stockMetrics}>
                  <div className={styles.metricsComparisonGrid}>
                    <div className={styles.metricBlock}>
                      <div 
                        className={styles.metricValue} 
                        style={{ color: item.totalOnHand === 0 ? '#f87171' : '#fbbf24' }}
                      >
                        {item.totalOnHand} <span className={styles.metricUom}>{item.uom}</span>
                      </div>
                      <div className={styles.metricLabel}>On-Hand Stock</div>
                    </div>

                    <div className={styles.metricBlock}>
                      <div className={styles.metricValue} style={{ color: 'var(--text-primary)' }}>
                        {item.reorderLevel} <span className={styles.metricUom}>{item.uom}</span>
                      </div>
                      <div className={styles.metricLabel}>Reorder Level</div>
                    </div>
                  </div>

                  <div className={styles.progressBarContainer}>
                    <div className={styles.progressBarBg}>
                      <div 
                        className={styles.progressBarFill} 
                        style={{ 
                          width: `${pct}%`, 
                          background: item.totalOnHand === 0 ? '#ef4444' : '#f59e0b' 
                        }} 
                      />
                    </div>
                    <div className={styles.progressLabel}>
                      <span>{pct}% of safety threshold</span>
                      <span style={{ color: '#f87171', fontWeight: 600 }}>-{item.deficit} {item.uom}</span>
                    </div>
                  </div>
                </div>

                {/* Dismissal info if dismissed */}
                {item.isDismissed && (item.dismissal || item.dismissedByName) && (
                  <div className={styles.dismissalInfo}>
                    <div>Dismissed by: <strong>{item.dismissal?.user?.name || item.dismissedByName || 'Manager'}</strong></div>
                    {item.dismissal?.quantityAtDismissal !== undefined && (
                      <div>Quantity at dismissal: {item.dismissal.quantityAtDismissal} {item.uom}</div>
                    )}
                    {(item.dismissal?.dismissedAt || item.dismissedAt) && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(item.dismissal?.dismissedAt || item.dismissedAt!).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Card Actions */}
                <div className={styles.cardActions}>
                  {onNavigateToMovements && (
                    <button
                      onClick={onNavigateToMovements}
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', gap: '0.4rem' }}
                    >
                      <ArrowLeftRight size={14} />
                      <span>Ledger Receipts</span>
                    </button>
                  )}

                  {!item.isDismissed && isManager && (
                    <button
                      onClick={() => handleDismissAlert(item.id, item.name)}
                      disabled={dismissingId === item.id}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '0.45rem 0.8rem', 
                        fontSize: '0.8rem', 
                        gap: '0.4rem',
                        borderColor: 'rgba(255, 255, 255, 0.2)'
                      }}
                      title="Silence this alert until stock recovers above reorder level and falls back"
                    >
                      <EyeOff size={14} />
                      <span>{dismissingId === item.id ? 'Dismissing...' : 'Dismiss Alert'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default AlertsPage;

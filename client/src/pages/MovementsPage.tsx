import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { 
  ArrowLeftRight, 
  ArrowDownLeft, 
  ArrowUpRight, 
  SlidersHorizontal, 
  Search, 
  Plus, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Package, 
  RefreshCw,
  Zap,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import styles from './MovementsPage.module.css';

interface Location {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  uom: string;
  reorderLevel: number;
  isArchived: boolean;
  totalOnHand?: number;
}

interface StockMovement {
  id: string;
  itemId: string;
  type: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT';
  quantity: number;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  reason: string | null;
  userId: string;
  createdAt: string;
  item: {
    id: string;
    sku: string;
    name: string;
    uom: string;
  };
  user: {
    id: string;
    name: string;
    role: 'MANAGER' | 'STAFF';
  };
  sourceLocation: {
    id: string;
    name: string;
    code: string;
  } | null;
  destinationLocation: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export const MovementsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isManager = user?.role === 'MANAGER';

  // Data states
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [typeFilter, locationFilter, searchQuery]);

  // Record Movement Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT'>('RECEIPT');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [sourceLocationId, setSourceLocationId] = useState<string>('');
  const [destinationLocationId, setDestinationLocationId] = useState<string>('');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Live stock check for Issue / Transfer / Adjustment
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);

  // Auto-open modal if URL specifies action=new (e.g. from 1-Click Restock Requisition)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      const type = searchParams.get('type') as any;
      const itemId = searchParams.get('itemId');
      const qty = searchParams.get('quantity');
      const dest = searchParams.get('dest');

      if (type && ['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT'].includes(type)) {
        setModalType(type);
      }
      if (itemId) {
        setSelectedItemId(itemId);
      }
      if (qty && !isNaN(Number(qty))) {
        setQuantity(Number(qty));
      }
      if (dest) {
        setDestinationLocationId(dest);
      }
      setIsModalOpen(true);
      // Clean query params so refresh does not keep modal re-opening
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [movData, itemsData, locsData] = await Promise.all([
        apiFetch<{ movements: StockMovement[] }>('/movements'),
        apiFetch<{ items: Item[] } | Item[]>('/items?includeArchived=false&all=true'),
        apiFetch<{ locations: Location[] }>('/locations'),
      ]);

      const extractedMovements = Array.isArray(movData?.movements)
        ? movData.movements
        : (Array.isArray(movData) ? movData : []);

      const extractedItems = Array.isArray(itemsData)
        ? itemsData
        : (Array.isArray((itemsData as any)?.items) ? (itemsData as any).items : []);

      const extractedLocations = Array.isArray(locsData?.locations)
        ? locsData.locations
        : (Array.isArray(locsData) ? locsData : []);

      setMovements(extractedMovements);
      setItems(extractedItems);
      setLocations(extractedLocations);
    } catch (err: any) {
      setError(err.message || 'Error loading stock movements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalError(null);
    setModalSuccess(null);
  }, []);

  // Lock body scroll and register Esc key for modal
  useEffect(() => {
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, closeModal]);

  // Check live available stock when item and source location change
  const activeSourceId = modalType === 'TRANSFER' || modalType === 'ISSUE' 
    ? sourceLocationId 
    : (modalType === 'ADJUSTMENT' && adjustmentDirection === 'DECREASE' ? sourceLocationId : null);

  useEffect(() => {
    if (!selectedItemId || !activeSourceId) {
      setAvailableStock(null);
      return;
    }

    let isMounted = true;
    setCheckingStock(true);

    apiFetch<{ itemId: string; locations: Array<{ locationId: string; onHand: number }> }>(`/movements/on-hand/${selectedItemId}`)
      .then((data) => {
        if (!isMounted) return;
        if (data?.locations && Array.isArray(data.locations)) {
          const locStock = data.locations.find((l: any) => l.locationId === activeSourceId);
          setAvailableStock(locStock ? locStock.onHand : 0);
        } else {
          setAvailableStock(0);
        }
      })
      .catch(() => {
        if (isMounted) setAvailableStock(null);
      })
      .finally(() => {
        if (isMounted) setCheckingStock(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedItemId, activeSourceId, modalType, adjustmentDirection]);

  // Open modal with clean defaults
  const openModal = (type: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT' = 'RECEIPT') => {
    setModalType(type);
    const itemArray = Array.isArray(items) ? items : [];
    setSelectedItemId(itemArray[0]?.id || '');
    setQuantity('');
    
    // Default location for staff: first assigned location; for manager: first active location
    const locArray = Array.isArray(locations) ? locations : [];
    const availableLocs = isManager 
      ? locArray 
      : locArray.filter(l => user?.assignedLocationIds?.includes(l.id));

    const defaultLoc = availableLocs[0]?.id || locArray[0]?.id || '';
    setSourceLocationId(defaultLoc);
    
    // For transfer, set destination to a different location if available
    const otherLoc = locArray.find(l => l.id !== defaultLoc)?.id || '';
    setDestinationLocationId(otherLoc || defaultLoc);

    setAdjustmentDirection('INCREASE');
    setReason('');
    setModalError(null);
    setModalSuccess(null);
    setIsModalOpen(true);
  };


  // Record movement handler
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    if (!selectedItemId) {
      setModalError('Please select an item.');
      return;
    }

    const numQty = Number(quantity);
    if (quantity === '' || isNaN(numQty) || numQty <= 0) {
      setModalError('Please enter a valid positive quantity.');
      return;
    }

    // Client-side availability checks
    if (activeSourceId && availableStock !== null && numQty > availableStock) {
      setModalError(`Cannot exceed available stock. Only ${availableStock} unit(s) available on hand.`);
      return;
    }

    if (modalType === 'TRANSFER' && sourceLocationId === destinationLocationId) {
      setModalError('Source and destination warehouse locations cannot be the same.');
      return;
    }

    if (modalType === 'ADJUSTMENT') {
      if (!isManager) {
        setModalError('Only Inventory Managers can record inventory adjustments.');
        return;
      }
      if (!reason || reason.trim().length === 0) {
        setModalError('This field is mandatory for inventory adjustments. Please provide an explanation before posting.');
        return;
      }
    }

    setSubmitting(true);

    try {
      let payload: any = {
        itemId: selectedItemId,
        type: modalType,
        quantity: numQty,
      };

      if (modalType === 'RECEIPT') {
        payload.destinationLocationId = destinationLocationId;
      } else if (modalType === 'ISSUE') {
        payload.sourceLocationId = sourceLocationId;
      } else if (modalType === 'TRANSFER') {
        payload.sourceLocationId = sourceLocationId;
        payload.destinationLocationId = destinationLocationId;
      } else if (modalType === 'ADJUSTMENT') {
        payload.locationId = sourceLocationId;
        payload.direction = adjustmentDirection;
        payload.reason = reason.trim();
      }

      const data = await apiFetch<{ movement: StockMovement }>('/movements', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setModalSuccess('Movement recorded successfully in the append-only ledger.');
      // Prepend newly recorded movement to view
      if (data?.movement) {
        setMovements((prev) => [data.movement, ...prev]);
      }

      setTimeout(() => {
        closeModal();
      }, 700);
    } catch (err: any) {
      setModalError(err.message || 'Failed to record stock movement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered movements
  const filteredMovements = useMemo(() => {
    if (!Array.isArray(movements)) return [];
    return movements.filter((m) => {
      if (!m) return false;
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (locationFilter !== 'all') {
        const matchesLoc = m.sourceLocationId === locationFilter || m.destinationLocationId === locationFilter;
        if (!matchesLoc) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesItem = (m.item?.name || '').toLowerCase().includes(q) || (m.item?.sku || '').toLowerCase().includes(q);
        const matchesReason = (m.reason || '').toLowerCase().includes(q);
        const matchesUser = (m.user?.name || '').toLowerCase().includes(q);
        if (!matchesItem && !matchesReason && !matchesUser) return false;
      }
      return true;
    });
  }, [movements, typeFilter, locationFilter, searchQuery]);

  // Pagination calculation
  const totalMovements = filteredMovements.length;
  const totalPages = Math.max(1, Math.ceil(totalMovements / limit));

  const paginatedMovements = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredMovements.slice(start, start + limit);
  }, [filteredMovements, page, limit]);

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const getPageNumbers = (current: number, max: number) => {
    const pages: (number | string)[] = [];
    if (max <= 5) {
      for (let i = 1; i <= max; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(max - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < max - 2) pages.push('...');
      pages.push(max);
    }
    return pages;
  };

  // Statistics counters
  const stats = useMemo(() => {
    let receipts = 0;
    let issues = 0;
    let transfers = 0;
    let adjustments = 0;

    if (Array.isArray(movements)) {
      movements.forEach((m) => {
        if (!m) return;
        if (m.type === 'RECEIPT') receipts += m.quantity;
        else if (m.type === 'ISSUE') issues += m.quantity;
        else if (m.type === 'TRANSFER') transfers += m.quantity;
        else if (m.type === 'ADJUSTMENT') adjustments += 1;
      });
    }

    return { total: Array.isArray(movements) ? movements.length : 0, receipts, issues, transfers, adjustments };
  }, [movements]);

  // Helper for selected item object
  const selectedItemObj = (Array.isArray(items) ? items : []).find((i) => i.id === selectedItemId);

  // Available locations for staff based on operation
  const eligibleSourceLocations = useMemo(() => {
    const locArray = Array.isArray(locations) ? locations : [];
    if (isManager) return locArray;
    return locArray.filter((l) => user?.assignedLocationIds?.includes(l.id));
  }, [locations, isManager, user]);

  const eligibleDestinationLocations = useMemo(() => {
    const locArray = Array.isArray(locations) ? locations : [];
    if (modalType === 'RECEIPT') {
      return isManager ? locArray : locArray.filter((l) => user?.assignedLocationIds?.includes(l.id));
    }
    // For transfer, destination can be any active warehouse
    return locArray;
  }, [locations, modalType, isManager, user]);

  return (
    <div className="page-container" style={{ width: '100%', boxSizing: 'border-box' }}>
      
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerInfo}>
          <div className={styles.titleRow}>
            <div className={styles.titleIconWrapper}>
              <ArrowLeftRight size={22} />
            </div>
            <h1 className={styles.pageTitle}>
              Stock Movement Ledger
            </h1>
          </div>
          <p className={styles.pageSubtitle}>
            Append-only physical inventory stream. On-hand balances are derived dynamically from transaction history.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button 
            onClick={fetchData} 
            className="btn btn-secondary"
            title="Refresh Ledger"
            style={{ padding: '0.65rem 0.9rem' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          
          <button 
            onClick={() => openModal('RECEIPT')} 
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.25rem' }}
          >
            <Plus size={18} />
            <span>Record Movement</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.75rem', borderRadius: 10 }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Movements</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.total}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.75rem', borderRadius: 10 }}>
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Units Received</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>+{stats.receipts}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.75rem', borderRadius: 10 }}>
            <ArrowUpRight size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Units Dispatched</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>-{stats.issues}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', padding: '0.75rem', borderRadius: 10 }}>
            <ArrowLeftRight size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Units Transferred</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22d3ee' }}>⇄ {stats.transfers}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div className={styles.movementFilterBar}>
          
          {/* Search Box */}
          <div className={styles.movementFilterSearch}>
            <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search by item name, SKU, user, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className={styles.movementFilterItem}>
            <SlidersHorizontal size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All Movement Types</option>
              <option value="RECEIPT">Inbound Receipts</option>
              <option value="ISSUE">Outbound Issues</option>
              <option value="TRANSFER">Internal Transfers</option>
              <option value="ADJUSTMENT">Audit Adjustments</option>
            </select>
          </div>

          {/* Location Filter */}
          <div className={styles.movementFilterItem}>
            <Building2 size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All Warehouse Locations</option>
              {(Array.isArray(locations) ? locations : []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  [{loc.code}] {loc.name}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Ledger Table / Content Stream */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 1rem auto', opacity: 0.6 }} />
          <div>Loading inventory ledger stream...</div>
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle size={36} color="var(--status-danger-text)" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: 600, color: 'var(--status-danger-text)', marginBottom: '0.5rem' }}>Failed to Load Ledger</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{error}</p>
          <button onClick={fetchData} className="btn btn-secondary">Retry</button>
        </div>
      ) : filteredMovements.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <Package size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Stock Movements Recorded</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
            {searchQuery || typeFilter !== 'all' || locationFilter !== 'all'
              ? 'No ledger records matched your active search filters. Try clearing your criteria.'
              : 'The append-only ledger is empty. Record your first warehouse receipt, transfer, or issue to begin tracking stock.'}
          </p>
          <button onClick={() => openModal('RECEIPT')} className="btn btn-primary">
            <Plus size={16} />
            <span>Record Initial Receipt</span>
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div className={styles.mobileScrollHint} style={{ padding: '0.75rem 1.25rem 0 1.25rem' }}>
            <ArrowLeftRight size={14} color="var(--accent-primary)" />
            <span>Swipe horizontally to view full ledger rows</span>
          </div>
          <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Timestamp</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Type</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Item / SKU</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Warehouse Route</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Actor</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Reason / Notes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.map((m) => {
                  const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : '—';

                  return (
                    <tr 
                      key={m.id} 
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {dateStr}
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                        {m.type === 'RECEIPT' && <span className="badge badge-receipt">+ RECEIPT</span>}
                        {m.type === 'ISSUE' && <span className="badge badge-issue">- ISSUE</span>}
                        {m.type === 'TRANSFER' && <span className="badge badge-transfer">⇄ TRANSFER</span>}
                        {m.type === 'ADJUSTMENT' && <span className="badge badge-adjustment">⚡ ADJUST</span>}
                      </td>

                      {/* Item */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {m.item?.name || 'Unknown Item'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {m.item?.sku || 'N/A'}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ 
                          fontWeight: 700, 
                          fontSize: '0.95rem',
                          color: m.type === 'RECEIPT' 
                            ? '#34d399' 
                            : m.type === 'ISSUE' 
                              ? '#fbbf24' 
                              : m.type === 'TRANSFER' 
                                ? '#22d3ee' 
                                : '#c084fc'
                        }}>
                          {m.type === 'RECEIPT' ? `+${m.quantity}` : m.type === 'ISSUE' ? `-${m.quantity}` : m.quantity}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                          {m.item?.uom || 'units'}
                        </span>
                      </td>

                      {/* Warehouse Route */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem' }}>
                        {m.type === 'RECEIPT' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Supplier</span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              [{m.destinationLocation?.code || 'LOC'}] {m.destinationLocation?.name || 'Warehouse'}
                            </span>
                          </div>
                        )}
                        {m.type === 'ISSUE' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              [{m.sourceLocation?.code || 'LOC'}] {m.sourceLocation?.name || 'Warehouse'}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span style={{ color: 'var(--text-muted)' }}>Outbound Dispatch</span>
                          </div>
                        )}
                        {m.type === 'TRANSFER' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600, color: '#fbbf24' }}>
                              [{m.sourceLocation?.code || 'SRC'}]
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span style={{ fontWeight: 600, color: '#34d399' }}>
                              [{m.destinationLocation?.code || 'DEST'}]
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ({m.destinationLocation?.name || ''})
                            </span>
                          </div>
                        )}
                        {m.type === 'ADJUSTMENT' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              [{m.sourceLocation ? m.sourceLocation.code : (m.destinationLocation?.code || 'LOC')}]
                            </span>
                            <span style={{ fontSize: '0.8rem', color: m.sourceLocation ? '#f87171' : '#34d399' }}>
                              {m.sourceLocation ? '(Stock Write-Down)' : '(Stock Write-Up)'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actor */}
                      <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {m.user?.name || 'System'}
                        </div>
                        <span className={`badge ${m.user?.role === 'MANAGER' ? 'badge-manager' : 'badge-staff'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          {m.user?.role || 'STAFF'}
                        </span>
                      </td>

                      {/* Reason / Notes */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 260 }}>
                        {m.reason ? (
                          <span style={{ wordBreak: 'break-word' }}>{m.reason}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {totalMovements > 0 && (
            <div className={styles.paginationBar} style={{ borderTop: '1px solid var(--border-subtle)', margin: 0 }}>
              <div className={styles.paginationInfo}>
                <span>
                  Showing <strong>{(page - 1) * limit + 1}</strong>–<strong>{Math.min(page * limit, totalMovements)}</strong> of{' '}
                  <strong>{totalMovements}</strong> movements
                </span>
                <span style={{ marginLeft: '0.6rem', paddingLeft: '0.6rem', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.6rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show:</span>
                  <select
                    aria-label="Movements per page"
                    value={limit}
                    onChange={(e) => handleLimitChange(Number(e.target.value))}
                    className="form-select"
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                      borderRadius: 6,
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      width: 'auto',
                    }}
                  >
                    <option value={10}>10 / page</option>
                    <option value={15}>15 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>
              </div>

              <div className={styles.paginationControls}>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers(page, totalPages).map((p, idx) =>
                  p === '...' ? (
                    <span
                      key={`ellipsis-${idx}`}
                      style={{ padding: '0 0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      className={`${styles.paginationBtn} ${page === p ? styles.paginationBtnActive : ''}`}
                      onClick={() => setPage(Number(p))}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD MOVEMENT MODAL                                                     */}
      {/* Follows all standards from frontend-responsiveness-and-workflow.md         */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={closeModal} 
          style={{ zIndex: 1000 }}
        >
          <div 
            className="modal-content modal-responsive-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 580 }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ArrowLeftRight size={20} color="var(--accent-primary)" />
                  <span>Record Stock Movement</span>
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  Immutable transaction written immediately to the inventory ledger.
                </p>
              </div>
              <button 
                onClick={closeModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Movement Type Segmented Tabs */}
            <div className={styles.movementTabsGrid}>
              <button
                type="button"
                onClick={() => {
                  setModalType('RECEIPT');
                  setModalError(null);
                }}
                className={`btn ${modalType === 'RECEIPT' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.2rem', fontSize: '0.75rem', borderRadius: 7 }}
              >
                Receipt
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalType('ISSUE');
                  setModalError(null);
                }}
                className={`btn ${modalType === 'ISSUE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.2rem', fontSize: '0.75rem', borderRadius: 7 }}
              >
                Dispatch
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalType('TRANSFER');
                  setModalError(null);
                }}
                className={`btn ${modalType === 'TRANSFER' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.2rem', fontSize: '0.75rem', borderRadius: 7 }}
              >
                Transfer
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isManager) {
                    setModalError('Only Inventory Managers can record stock adjustments.');
                  } else {
                    setModalType('ADJUSTMENT');
                    setModalError(null);
                  }
                }}
                className={`btn ${modalType === 'ADJUSTMENT' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.2rem', fontSize: '0.75rem', borderRadius: 7 }}
              >
                Adjust
              </button>
            </div>

            {/* Error / Success Feedback Banners */}
            {modalError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f87171', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#34d399', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRecordMovement} noValidate>
              
              {/* Item Selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Select Item <span style={{ color: '#f87171' }}>*</span>
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="form-select"
                  required
                >
                  {(Array.isArray(items) ? items : []).map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.sku}] {item.name} ({item.uom})
                    </option>
                  ))}
                </select>
              </div>

              {/* ROUTE FIELDS BASED ON TYPE */}
              {/* 1. RECEIPT: Destination only */}
              {modalType === 'RECEIPT' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Receiving Destination Warehouse <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <select
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    className="form-select"
                    required
                  >
                    {eligibleDestinationLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        [{loc.code}] {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. ISSUE: Source only */}
              {modalType === 'ISSUE' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Source Warehouse (Dispatching From) <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    {checkingStock ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Checking stock...</span>
                    ) : availableStock !== null ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: availableStock > 0 ? '#34d399' : '#f87171' }}>
                        Available: {availableStock} {selectedItemObj?.uom || 'units'}
                      </span>
                    ) : null}
                  </div>
                  <select
                    value={sourceLocationId}
                    onChange={(e) => setSourceLocationId(e.target.value)}
                    className="form-select"
                    required
                  >
                    {eligibleSourceLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        [{loc.code}] {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 3. TRANSFER: Source and Destination */}
              {modalType === 'TRANSFER' && (
                <div className={styles.movementFormGrid}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        From <span style={{ color: '#f87171' }}>*</span>
                      </label>
                      {availableStock !== null && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: availableStock > 0 ? '#34d399' : '#f87171' }}>
                          Avail: {availableStock} {selectedItemObj?.uom || ''}
                        </span>
                      )}
                    </div>
                    <select
                      value={sourceLocationId}
                      onChange={(e) => setSourceLocationId(e.target.value)}
                      className="form-select"
                    >
                      {eligibleSourceLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          [{loc.code}] {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                      To <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <select
                      value={destinationLocationId}
                      onChange={(e) => setDestinationLocationId(e.target.value)}
                      className="form-select"
                    >
                      {(Array.isArray(locations) ? locations : []).map((loc) => (
                        <option key={loc.id} value={loc.id} disabled={loc.id === sourceLocationId}>
                          [{loc.code}] {loc.name} {loc.id === sourceLocationId ? '(source)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 4. ADJUSTMENT: Manager only, Direction, Location, Mandatory Reason */}
              {modalType === 'ADJUSTMENT' && (
                <>
                  <div className={styles.movementFormGrid}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                        Warehouse Location <span style={{ color: '#f87171' }}>*</span>
                      </label>
                      <select
                        value={sourceLocationId}
                        onChange={(e) => setSourceLocationId(e.target.value)}
                        className="form-select"
                      >
                        {(Array.isArray(locations) ? locations : []).map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            [{loc.code}] {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                        Adjustment Direction <span style={{ color: '#f87171' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setAdjustmentDirection('INCREASE')}
                          className={`btn ${adjustmentDirection === 'INCREASE' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '0.65rem 0.3rem', fontSize: '0.8rem' }}
                        >
                          + Add Stock
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustmentDirection('DECREASE')}
                          className={`btn ${adjustmentDirection === 'DECREASE' ? 'btn-danger' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '0.65rem 0.3rem', fontSize: '0.8rem' }}
                        >
                          - Write-Down
                        </button>
                      </div>
                    </div>
                  </div>

                  {adjustmentDirection === 'DECREASE' && availableStock !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: availableStock > 0 ? '#34d399' : '#f87171', marginBottom: '1rem' }}>
                      <Info size={14} />
                      <span>Available on hand at selected location: {availableStock} {selectedItemObj?.uom}</span>
                    </div>
                  )}
                </>
              )}

              {/* Quantity Field */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Movement Quantity ({selectedItemObj?.uom || 'units'}) <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 50"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="form-input"
                  required
                />
              </div>

              {/* Reason / Notes Field (Mandatory for adjustments) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {modalType === 'ADJUSTMENT' ? (
                      <span>Reason for Adjustment <span style={{ color: '#f87171' }}>* (Mandatory)</span></span>
                    ) : (
                      <span>Operational Notes (Optional)</span>
                    )}
                  </label>
                  {modalType === 'ADJUSTMENT' && (
                    <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 600 }}>Required</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  placeholder={
                    modalType === 'ADJUSTMENT'
                      ? 'Explain discrepancy (e.g. Cycle count variance, water damage, scrap)'
                      : 'e.g. Purchase order PO-9481, Bill of Lading, Expedited shipment'
                  }
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (modalError && modalError.includes('mandatory')) {
                      setModalError(null);
                    }
                  }}
                  className="form-textarea"
                  style={{
                    borderColor: modalError && modalType === 'ADJUSTMENT' && (!reason || !reason.trim()) ? '#f87171' : undefined,
                    boxShadow: modalError && modalType === 'ADJUSTMENT' && (!reason || !reason.trim()) ? '0 0 0 2px rgba(239, 68, 68, 0.25)' : undefined,
                  }}
                />
                {modalError && modalType === 'ADJUSTMENT' && (!reason || !reason.trim()) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f87171', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    <AlertCircle size={14} />
                    <span>This field is mandatory for inventory adjustments.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className={styles.movementActionButtons} style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span>Recording...</span>
                  ) : (
                    <>
                      <Zap size={16} />
                      <span>Post to Ledger</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

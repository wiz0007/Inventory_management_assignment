import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { 
  Boxes, 
  Plus, 
  Search, 
  History, 
  Archive, 
  ArchiveRestore, 
  Edit3, 
  CheckCircle2, 
  X, 
  Send, 
  Layers, 
  Trash2,
  ArrowLeftRight,
  Building2,
  Package,
  AlertTriangle,
  MapPin,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw
} from 'lucide-react';
import styles from './ItemsPage.module.css';

interface Location {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

interface ItemsApiResponse {
  items: Item[];
  pagination: PaginationMetadata;
}

interface Category {
  id: string;
  name: string;
  _count?: { items: number };
}

interface ItemTimelineEvent {
  id: string;
  itemId: string;
  userId: string;
  eventType: 'CREATED' | 'FIELD_CHANGE' | 'NOTE';
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  noteText?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'MANAGER' | 'STAFF';
  };
}

interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  uom: string;
  reorderLevel: number;
  categoryId: string;
  isArchived: boolean;
  totalOnHand?: number;
  isLowStock?: boolean;
  createdAt: string;
  updatedAt: string;
  category: Category;
  _count?: {
    movements: number;
    timeline: number;
  };
}

export const ItemsPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  // Catalog State (Server-Side Querying, Filtering & Pagination - Requirement 6)
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [timelineItem, setTimelineItem] = useState<Item | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<ItemTimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [detailTab, setDetailTab] = useState<'TIMELINE' | 'MOVEMENTS' | 'LOCATIONS'>('TIMELINE');
  const [itemStockLocations, setItemStockLocations] = useState<any[]>([]);
  const [itemMovements, setItemMovements] = useState<any[]>([]);

  // Form States
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemUom, setNewItemUom] = useState('units');
  const [newItemReorder, setNewItemReorder] = useState(10);
  const [newItemCategory, setNewItemCategory] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Note form state in Timeline
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Category management modal states
  const [newCatName, setNewCatName] = useState('');
  const [catError, setCatError] = useState('');
  const [catSuccess, setCatSuccess] = useState('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState('');

  // Modal accessibility & UX edge cases: Escape key dismiss & body scroll locking
  const hasActiveModal = Boolean(showAddModal || showEditModal || showCategoryModal || timelineItem);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowEditModal(false);
        setShowCategoryModal(false);
        setTimelineItem(null);
        setFormError('');
        setCatError('');
        setCatSuccess('');
      }
    };

    if (hasActiveModal) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [hasActiveModal]);

  // Debounce search query changes by 300ms to avoid server spam
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Items from server-side querying engine (Requirement 6)
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      let query = `/items?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (archiveFilter !== 'all') {
        query += `&archived=${archiveFilter}`;
      } else {
        query += `&archived=all`;
      }
      if (selectedCategory !== 'all') {
        query += `&categoryId=${encodeURIComponent(selectedCategory)}`;
      }
      if (selectedLocation !== 'all') {
        query += `&locationId=${encodeURIComponent(selectedLocation)}`;
      }
      if (debouncedSearch.trim()) {
        query += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      }
      if (lowStockOnly) {
        query += `&lowStockOnly=true`;
      }

      const data = await apiFetch<ItemsApiResponse | Item[]>(query);
      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setItems(data.items || []);
        setTotal(data.pagination?.total ?? (data.items?.length || 0));
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, archiveFilter, selectedCategory, selectedLocation, debouncedSearch, lowStockOnly]);

  const fetchCategories = async () => {
    try {
      const data = await apiFetch<Category[]>('/categories');
      setCategories(data);
      if (data.length > 0 && !newItemCategory) {
        setNewItemCategory(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await apiFetch<{ locations: Location[] } | Location[]>('/locations');
      const list = Array.isArray(data) ? data : (data.locations || []);
      setLocations(list.filter((loc: Location) => loc.isActive));
    } catch (err: any) {
      console.error('Failed to load locations:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchQuery);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setPage(1);
  };

  const handleLocationChange = (val: string) => {
    setSelectedLocation(val);
    setPage(1);
  };

  const handleArchiveChange = (val: 'active' | 'archived' | 'all') => {
    setArchiveFilter(val);
    setPage(1);
  };

  const handleLowStockToggle = () => {
    setLowStockOnly((prev) => !prev);
    setPage(1);
  };

  const handleSortChange = (val: string) => {
    const [col, dir] = val.split('-');
    setSortBy(col);
    setSortOrder((dir as 'asc' | 'desc') || 'asc');
    setPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setArchiveFilter('active');
    setLowStockOnly(false);
    setSortBy('name');
    setSortOrder('asc');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedCategory !== 'all' ||
    selectedLocation !== 'all' ||
    archiveFilter !== 'active' ||
    lowStockOnly ||
    sortBy !== 'name' ||
    sortOrder !== 'asc'
  );

  // Open Add Item Modal
  const handleOpenAdd = () => {
    setNewItemSku('');
    setNewItemName('');
    setNewItemDesc('');
    setNewItemUom('units');
    setNewItemReorder(10);
    setNewItemCategory(categories[0]?.id || '');
    setFormError('');
    setShowAddModal(true);
  };

  // Handle Create Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      await apiFetch('/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: newItemSku.trim().toUpperCase(),
          name: newItemName.trim(),
          description: newItemDesc.trim() || undefined,
          uom: newItemUom.trim(),
          reorderLevel: Number(newItemReorder),
          categoryId: newItemCategory,
        }),
      });

      setShowAddModal(false);
      setSuccessMessage(`Item "${newItemName}" (${newItemSku.toUpperCase()}) created successfully with initialized audit log.`);
      setTimeout(() => setSuccessMessage(''), 4000);
      fetchItems();
      fetchCategories();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: Item) => {
    setSelectedItem(item);
    setNewItemName(item.name);
    setNewItemDesc(item.description || '');
    setNewItemUom(item.uom);
    setNewItemReorder(item.reorderLevel);
    setNewItemCategory(item.categoryId);
    setFormError('');
    setShowEditModal(true);
  };

  // Handle Update Item
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setFormError('');
    setSubmitting(true);

    try {
      const res = await apiFetch<{ item: Item; changesLogged: number }>(`/items/${selectedItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: newItemName.trim(),
          description: newItemDesc.trim() || null,
          uom: newItemUom.trim(),
          reorderLevel: Number(newItemReorder),
          categoryId: newItemCategory,
        }),
      });

      setShowEditModal(false);
      setSuccessMessage(`Item updated. ${res.changesLogged} field changes recorded to audit timeline.`);
      setTimeout(() => setSuccessMessage(''), 4000);
      fetchItems();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update item');
    } finally {
      setSubmitting(false);
    }
  };

  // Archive / Unarchive Item
  const handleToggleArchive = async (item: Item) => {
    const action = item.isArchived ? 'unarchive' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} "${item.name}" (${item.sku})?`)) {
      return;
    }

    try {
      await apiFetch(`/items/${item.id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !item.isArchived }),
      });

      setSuccessMessage(`Item "${item.name}" was ${item.isArchived ? 'restored to active inventory' : 'archived'}.`);
      setTimeout(() => setSuccessMessage(''), 4000);
      fetchItems();
      if (timelineItem?.id === item.id) {
        openTimeline(item);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update archive status');
    }
  };

  // Open Timeline & Item Ledger Drawer
  const openTimeline = async (item: Item) => {
    setTimelineItem(item);
    setDetailTab('TIMELINE');
    setLoadingTimeline(true);
    try {
      const [res, stockRes, movRes] = await Promise.all([
        apiFetch<{ timeline: ItemTimelineEvent[] }>(`/items/${item.id}/timeline`),
        fetch(`/api/movements/on-hand/${item.id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({ locations: [] })),
        fetch(`/api/movements/item/${item.id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({ movements: [] })),
      ]);
      setTimelineEvents(res.timeline || []);
      setItemStockLocations(stockRes.locations || []);
      setItemMovements(movRes.movements || []);
    } catch (err: any) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Add Note to Timeline
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineItem || !newNote.trim()) return;

    setAddingNote(true);
    try {
      const addedEvent = await apiFetch<ItemTimelineEvent>(`/items/${timelineItem.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ noteText: newNote.trim() }),
      });

      setTimelineEvents([addedEvent, ...timelineEvents]);
      setNewNote('');
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    setCatSuccess('');

    if (!newCatName.trim()) return;

    try {
      const cat = await apiFetch<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      setCatSuccess(`Category "${cat.name}" added successfully.`);
      setNewCatName('');
      fetchCategories();
    } catch (err: any) {
      setCatError(err.message || 'Failed to create category');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    setCatError('');
    setCatSuccess('');

    try {
      await apiFetch(`/categories/${cat.id}`, { method: 'DELETE' });
      setCatSuccess(`Category "${cat.name}" deleted.`);
      fetchCategories();
      fetchItems();
    } catch (err: any) {
      setCatError(err.message || 'Failed to delete category');
    }
  };

  // Active warehouse location lookup
  const activeLocationObj = locations.find((l) => l.id === selectedLocation);

  // Smart page pill generator for pagination bar
  const getPageNumbers = (current: number, max: number): (number | string)[] => {
    if (max <= 5) {
      return Array.from({ length: max }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (current <= 3) {
      pages.push(1, 2, 3, 4, '...', max);
    } else if (current >= max - 2) {
      pages.push(1, '...', max - 3, max - 2, max - 1, max);
    } else {
      pages.push(1, '...', current - 1, current, current + 1, '...', max);
    }
    return pages;
  };

  // Items are directly driven by server query engine (Requirement 6)
  const displayedItems = items;

  return (
    <div className={styles.catalogPageContainer}>
      
      {/* Top Header & Overview */}
      <div className={styles.catalogHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Inventory & Items Catalog
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem', maxWidth: 650 }}>
            Master product catalog with category taxonomy, reorder thresholds, soft-archiving, and immutable audit timeline logs.
          </p>
        </div>

        {/* Action Controls */}
        <div className={styles.catalogHeaderActions} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isManager && (
            <>
              <button 
                onClick={() => setShowCategoryModal(true)} 
                className={`btn btn-secondary ${styles.catalogActionBtn}`}
                style={{ fontSize: '0.85rem' }}
              >
                <Layers size={16} />
                Categories ({categories.length})
              </button>

              <button 
                onClick={handleOpenAdd} 
                className={`btn btn-primary ${styles.catalogActionBtn}`}
                style={{ fontSize: '0.85rem' }}
              >
                <Plus size={16} />
                Add Item
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          borderRadius: 10,
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.875rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar (Sprint 4: Multi-Criteria Server Querying - Req 6) */}
      <div className={`glass-panel ${styles.catalogFilterContainer}`}>
        {/* Row 1: Search Form + Archived Segment + Low Stock Toggle */}
        <div className={styles.catalogSearchRow}>
          {/* Search Form with Debounce & Clear Button */}
          <form onSubmit={handleSearchSubmit} className={styles.catalogSearchBox} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search SKU, item name, or description..."
                className="form-input"
                style={{ paddingLeft: '2.25rem', paddingRight: searchQuery ? '2rem' : '0.85rem', fontSize: '0.875rem' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.55rem 0.9rem', flexShrink: 0 }}>
              Search
            </button>
          </form>

          {/* Archived Segmented Group & Low Stock Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Low-Stock Toggle Button (Requirement 6) */}
            <button
              type="button"
              onClick={handleLowStockToggle}
              className={`${styles.catalogLowStockBtn} ${lowStockOnly ? styles.catalogLowStockBtnActive : styles.catalogLowStockBtnInactive}`}
              title="Filter items at or below reorder threshold"
            >
              <AlertTriangle size={15} color={lowStockOnly ? '#f87171' : 'var(--status-warning-text)'} />
              <span>Low Stock Only</span>
            </button>

            {/* Active / Archived Pill Selector */}
            <div className={styles.filterSegmentedGroup} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface-elevated)', borderRadius: 8, padding: '0.2rem', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => handleArchiveChange('active')}
                className={`${styles.filterSegmentBtn} ${archiveFilter === 'active' ? styles.filterSegmentBtnActive : ''}`}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: archiveFilter === 'active' ? 'var(--accent-primary)' : 'transparent',
                  color: archiveFilter === 'active' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => handleArchiveChange('archived')}
                className={`${styles.filterSegmentBtn} ${archiveFilter === 'archived' ? styles.filterSegmentBtnActive : ''}`}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: archiveFilter === 'archived' ? 'var(--accent-primary)' : 'transparent',
                  color: archiveFilter === 'archived' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                Archived
              </button>
              <button
                type="button"
                onClick={() => handleArchiveChange('all')}
                className={`${styles.filterSegmentBtn} ${archiveFilter === 'all' ? styles.filterSegmentBtnActive : ''}`}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: archiveFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
                  color: archiveFilter === 'all' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Category, Location, and Sort Dropdowns + Reset Button */}
        <div className={styles.catalogControlsRow}>
          <div className={styles.catalogFiltersGroup}>
            {/* Category Dropdown */}
            <div className={styles.catalogFilterItem}>
              <Layers size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <select
                id="category-select"
                aria-label="Filter by Category"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} {cat._count?.items !== undefined ? `(${cat._count.items})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse Location Dropdown */}
            <div className={styles.catalogFilterItem}>
              <MapPin size={15} color="#06b6d4" style={{ flexShrink: 0 }} />
              <select
                id="location-select"
                aria-label="Filter by Warehouse Location"
                value={selectedLocation}
                onChange={(e) => handleLocationChange(e.target.value)}
              >
                <option value="all">All Locations (Company Total)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className={styles.catalogFilterItem}>
              <ArrowUpDown size={15} color="#c084fc" style={{ flexShrink: 0 }} />
              <select
                id="sort-select"
                aria-label="Sort catalog items"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="name-asc">Sort: Name (A → Z)</option>
                <option value="name-desc">Sort: Name (Z → A)</option>
                <option value="onHand-desc">Sort: Stock (High → Low)</option>
                <option value="onHand-asc">Sort: Stock (Low → High)</option>
                <option value="reorderLevel-desc">Sort: Reorder (High → Low)</option>
                <option value="reorderLevel-asc">Sort: Reorder (Low → High)</option>
                <option value="sku-asc">Sort: SKU (A → Z)</option>
              </select>
            </div>
          </div>

          {/* Reset Filters Shortcut */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                alignSelf: 'center',
              }}
              title="Reset all search queries and active filters"
            >
              <RotateCcw size={13} />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          Loading catalog items...
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Boxes size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>No items match your criteria</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
            {archiveFilter === 'archived' 
              ? 'No archived items found in this category.' 
              : 'Add your first inventory product using the "+ Add Item" button above.'}
          </p>
          {isManager && archiveFilter === 'active' && (
            <button onClick={handleOpenAdd} className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
              <Plus size={16} />
              Create Item Now
            </button>
          )}
        </div>
      ) : (
        <div className={styles.catalogItemsGrid}>
          {displayedItems.map((item) => (
            <div 
              key={item.id} 
              className={`glass-panel card-hover ${styles.itemCard}`}
              onClick={() => openTimeline(item)}
              style={{
                cursor: 'pointer',
                opacity: item.isArchived ? 0.75 : 1,
                border: item.isArchived ? '1px dashed rgba(148, 163, 184, 0.3)' : undefined,
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              {/* Card Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="sku-pill">
                    {item.sku}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-muted)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {item.category?.name || 'Uncategorized'}
                    </span>
                    {activeLocationObj && (
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: 'rgba(6, 182, 212, 0.15)',
                        color: '#38bdf8',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        border: '1px solid rgba(6, 182, 212, 0.35)'
                      }}>
                        📍 {activeLocationObj.code}
                      </span>
                    )}
                    {item.isArchived && (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        Archived
                      </span>
                    )}
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.5rem 0 0.25rem 0', color: 'var(--text-primary)' }}>
                  {item.name}
                </h3>

                <p style={{
                  fontSize: '0.825rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.4,
                  minHeight: '2.4rem',
                  margin: '0.25rem 0 1rem 0'
                }}>
                  {item.description || 'No description provided.'}
                </p>

                {/* Specs Box */}
                <div className={styles.itemSpecBox}>
                  <div>
                    <div className={styles.itemSpecLabel}>
                      UOM
                    </div>
                    <div className={styles.itemSpecValue}>
                      {item.uom}
                    </div>
                  </div>

                  <div>
                    <div className={styles.itemSpecLabel}>
                      Reorder
                    </div>
                    <div className={styles.itemSpecValue} style={{ color: '#f59e0b' }}>
                      {item.reorderLevel}
                    </div>
                  </div>

                  <div>
                    <div className={styles.itemSpecLabel}>
                      {activeLocationObj ? `At ${activeLocationObj.code}` : 'On Hand'}
                    </div>
                    <div className={styles.itemSpecValue} style={{ 
                      color: item.totalOnHand !== undefined 
                        ? (item.totalOnHand <= item.reorderLevel ? '#f87171' : '#34d399')
                        : 'var(--text-primary)',
                      fontWeight: 700
                    }}>
                      {item.totalOnHand ?? 0} {item.uom}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', gap: '0.4rem' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => openTimeline(item)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.775rem', padding: '0.35rem 0.65rem', gap: '0.35rem' }}
                >
                  <History size={14} color="var(--accent-primary)" />
                  Details & Stock
                </button>

                {isManager && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(item);
                      }}
                      className="btn btn-secondary"
                      title="Edit item specifications"
                      style={{ padding: '0.35rem 0.55rem' }}
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleArchive(item);
                      }}
                      className="btn btn-secondary"
                      title={item.isArchived ? 'Restore item to active catalog' : 'Archive item'}
                      style={{ padding: '0.35rem 0.55rem', color: item.isArchived ? '#34d399' : '#f87171' }}
                    >
                      {item.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Server-Side Pagination Bar (Sprint 4 / Requirement 6) */}
      {total > 0 && (
        <div className={`glass-panel ${styles.paginationBar}`}>
          <div className={styles.paginationInfo}>
            <span>
              Showing <strong>{(page - 1) * limit + 1}</strong>–<strong>{Math.min(page * limit, total)}</strong> of{' '}
              <strong>{total}</strong> items
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show:</span>
              <select
                aria-label="Items per page"
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
                <option value={12}>12 / page</option>
                <option value={24}>24 / page</option>
                <option value={48}>48 / page</option>
              </select>
            </div>
          </div>

          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.paginationBtn}
              disabled={page <= 1 || loading}
              onClick={() => setPage(1)}
              title="First Page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              className={styles.paginationBtn}
              disabled={page <= 1 || loading}
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
                  disabled={loading}
                  onClick={() => setPage(Number(p))}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className={styles.paginationBtn}
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className={styles.paginationBtn}
              disabled={page >= totalPages || loading}
              onClick={() => setPage(totalPages)}
              title="Last Page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD ITEM MODAL (Manager Only)                             */}
      {/* ======================================================== */}
      {showAddModal && (
        <div 
          onClick={() => { setShowAddModal(false); setFormError(''); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div 
            className="glass-panel modal-responsive-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
          >
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Add New Catalog Item
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Create an item in the system. An initial creation event will be written to the immutable audit log.
            </p>

            {formError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '0.65rem 0.85rem',
                borderRadius: 8,
                fontSize: '0.825rem',
                marginBottom: '1rem'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateItem}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">SKU (Stock Keeping Unit)</label>
                  <input
                    type="text"
                    required
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value.toUpperCase())}
                    placeholder="e.g. ELEC-1001"
                    className="form-input"
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label className="form-label">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="form-input"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Heavy Duty Copper Wiring 10m"
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Unit of Measure (UOM)</label>
                  <input
                    type="text"
                    required
                    value={newItemUom}
                    onChange={(e) => setNewItemUom(e.target.value)}
                    placeholder="e.g. units, box, kg, rolls"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Reorder Level Threshold</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newItemReorder}
                    onChange={(e) => setNewItemReorder(parseInt(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Description (Optional)</label>
                <textarea
                  rows={3}
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Technical specifications, storage rules, packaging details..."
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Creating Item...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT ITEM MODAL (Manager Only)                            */}
      {/* ======================================================== */}
      {showEditModal && selectedItem && (
        <div 
          onClick={() => { setShowEditModal(false); setFormError(''); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div 
            className="glass-panel modal-responsive-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
          >
            <button
              onClick={() => setShowEditModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Edit Item Specifications
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              SKU: <strong style={{ color: 'var(--accent-primary)' }}>{selectedItem.sku}</strong>. Any changed fields will be recorded with before & after values in the audit timeline.
            </p>

            {formError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '0.65rem 0.85rem',
                borderRadius: 8,
                fontSize: '0.825rem',
                marginBottom: '1rem'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdateItem}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="form-input"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Unit of Measure (UOM)</label>
                  <input
                    type="text"
                    required
                    value={newItemUom}
                    onChange={(e) => setNewItemUom(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Reorder Level Threshold</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newItemReorder}
                  onChange={(e) => setNewItemReorder(parseInt(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Description</label>
                <textarea
                  rows={3}
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* IMMUTABLE AUDIT TIMELINE DRAWER / MODAL (Req 9)           */}
      {/* ======================================================== */}
      {timelineItem && (
        <div 
          onClick={() => setTimelineItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div 
            className={`glass-panel ${styles.modalResponsivePanel}`} 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setTimelineItem(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '0.75rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Package size={20} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                  {timelineItem.name}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {timelineItem.sku}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span className="badge" style={{ background: 'var(--bg-surface-elevated)' }}>
                  {timelineItem.category.name}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Reorder: <strong style={{ color: '#f59e0b' }}>{timelineItem.reorderLevel} {timelineItem.uom}</strong>
                </span>
              </div>

              {/* Sub-Tabs: Responsive Desktop Pill Buttons + Mobile Select Dropdown */}
              <div className={styles.detailTabsDesktop}>
                <button
                  type="button"
                  onClick={() => setDetailTab('TIMELINE')}
                  className={`btn ${detailTab === 'TIMELINE' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', flex: '1 1 auto', whiteSpace: 'nowrap' }}
                >
                  <History size={14} />
                  <span>Audit Timeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('LOCATIONS')}
                  className={`btn ${detailTab === 'LOCATIONS' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', flex: '1 1 auto', whiteSpace: 'nowrap' }}
                >
                  <Building2 size={14} />
                  <span>Warehouse Stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('MOVEMENTS')}
                  className={`btn ${detailTab === 'MOVEMENTS' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', flex: '1 1 auto', whiteSpace: 'nowrap' }}
                >
                  <ArrowLeftRight size={14} />
                  <span>Movement Ledger ({itemMovements.length})</span>
                </button>
              </div>

              {/* Mobile Viewport Tab Dropdown (<= 520px) */}
              <div className={styles.detailTabsMobile}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, color: 'var(--accent-primary)' }}>
                  {detailTab === 'TIMELINE' && <History size={16} />}
                  {detailTab === 'LOCATIONS' && <Building2 size={16} />}
                  {detailTab === 'MOVEMENTS' && <ArrowLeftRight size={16} />}
                </div>
                <select
                  value={detailTab}
                  onChange={(e) => setDetailTab(e.target.value as any)}
                  aria-label="Select item detail tab"
                >
                  <option value="TIMELINE">Audit Timeline ({timelineEvents.length})</option>
                  <option value="LOCATIONS">Warehouse Stock Breakdown</option>
                  <option value="MOVEMENTS">Movement Ledger ({itemMovements.length})</option>
                </select>
              </div>
            </div>

            {/* TAB 1: AUDIT TIMELINE */}
            {detailTab === 'TIMELINE' && (
              <>
                {/* Add Note Input Area (Available for both Manager and Staff) */}
                <form onSubmit={handleAddNote} style={{ marginBottom: '1rem', width: '100%', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Record an inspection log or note..."
                      className="form-input"
                      style={{ fontSize: '0.85rem', flex: '1 1 180px', minWidth: 0 }}
                    />
                    <button 
                      type="submit" 
                      disabled={addingNote || !newNote.trim()} 
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Send size={15} />
                      {addingNote ? 'Saving...' : 'Add Note'}
                    </button>
                  </div>
                </form>

                {/* Timeline Stream */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: '0.25rem', width: '100%', minWidth: 0 }}>
                  {loadingTimeline ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Loading timeline history...
                    </div>
                  ) : timelineEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No timeline events found.
                    </div>
                  ) : (
                    <div className={styles.timelineStreamContainer} style={{ position: 'relative', paddingLeft: '1.25rem', borderLeft: '2px solid rgba(99, 102, 241, 0.25)', marginLeft: '0.5rem', minWidth: 0 }}>
                      {timelineEvents.map((ev) => {
                        const isCreated = ev.eventType === 'CREATED';
                        const isFieldChange = ev.eventType === 'FIELD_CHANGE';
                        const isNote = ev.eventType === 'NOTE';
                        const dateStr = new Date(ev.createdAt).toLocaleString();

                        return (
                          <div key={ev.id} style={{ position: 'relative', marginBottom: '1rem', minWidth: 0 }}>
                            <div style={{
                              position: 'absolute',
                              left: '-1.65rem',
                              top: '0.25rem',
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: isCreated ? '#10b981' : isFieldChange ? '#6366f1' : '#f59e0b',
                              boxShadow: `0 0 8px ${isCreated ? 'rgba(16, 185, 129, 0.5)' : isFieldChange ? 'rgba(99, 102, 241, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
                              border: '2px solid var(--bg-surface)'
                            }} />

                            <div className={styles.timelineEventCard}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.4rem', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem', minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
                                    <span style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: 4,
                                      background: isCreated ? 'rgba(16, 185, 129, 0.2)' : isFieldChange ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                      color: isCreated ? '#34d399' : isFieldChange ? '#818cf8' : '#fbbf24'
                                    }}>
                                      {ev.eventType}
                                    </span>
                                    <span className={ev.user.role === 'MANAGER' ? 'badge badge-manager' : 'badge badge-staff'} style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>
                                      {ev.user.role}
                                    </span>
                                  </div>

                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {dateStr}
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', minWidth: 0 }}>
                                  {ev.user.name}
                                </div>
                              </div>

                              {isFieldChange && (
                                <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', marginTop: '0.25rem', minWidth: 0 }}>
                                  Modified field <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>{ev.fieldName}</code>:
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem', fontSize: '0.8rem' }}>
                                    <span style={{ textDecoration: 'line-through', color: '#f87171' }}>
                                      {ev.oldValue || '(empty)'}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)' }}>➔</span>
                                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                                      {ev.newValue || '(empty)'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {(isCreated || isNote) && (
                                <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', marginTop: '0.2rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {ev.noteText}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: WAREHOUSE STOCK BREAKDOWN */}
            {detailTab === 'LOCATIONS' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {itemStockLocations.map((loc: any) => (
                    <div key={loc.locationId} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Building2 size={16} color="var(--accent-primary)" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>
                          [{loc.locationCode}]
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        {loc.locationName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: loc.onHand > 0 ? '#34d399' : 'var(--text-muted)' }}>
                          {loc.onHand}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {timelineItem.uom} on hand
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Company-Wide On Hand</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                      {itemStockLocations.reduce((sum: number, l: any) => sum + (l.onHand || 0), 0)} {timelineItem.uom}
                    </div>
                  </div>
                  <div>
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      Reorder Threshold: {timelineItem.reorderLevel} {timelineItem.uom}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MOVEMENT LEDGER */}
            {detailTab === 'MOVEMENTS' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                {itemMovements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No movement records found for this item.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {itemMovements.map((m: any) => {
                      const dateStr = new Date(m.createdAt).toLocaleString();
                      return (
                        <div key={m.id} className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {m.type === 'RECEIPT' && <span className="badge badge-receipt">+ RECEIPT</span>}
                            {m.type === 'ISSUE' && <span className="badge badge-issue">- ISSUE</span>}
                            {m.type === 'TRANSFER' && <span className="badge badge-transfer">⇄ TRANSFER</span>}
                            {m.type === 'ADJUSTMENT' && <span className="badge badge-adjustment">⚡ ADJUST</span>}

                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                {m.type === 'RECEIPT' && `Received into ${m.destinationLocation?.name}`}
                                {m.type === 'ISSUE' && `Issued from ${m.sourceLocation?.name}`}
                                {m.type === 'TRANSFER' && `${m.sourceLocation?.code} → ${m.destinationLocation?.code}`}
                                {m.type === 'ADJUSTMENT' && `Adjustment at ${m.sourceLocation ? m.sourceLocation.name : m.destinationLocation?.name}`}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {dateStr} by {m.user?.name}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: m.type === 'RECEIPT' ? '#34d399' : m.type === 'ISSUE' ? '#fbbf24' : '#c084fc' }}>
                              {m.type === 'RECEIPT' ? `+${m.quantity}` : m.type === 'ISSUE' ? `-${m.quantity}` : m.quantity} {timelineItem.uom}
                            </div>
                            {m.reason && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: 200 }}>
                                "{m.reason}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Append-only ledger: Changes are immutable.
              </span>
              <button onClick={() => setTimelineItem(null)} className="btn btn-secondary" style={{ fontSize: '0.825rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CATEGORY MANAGEMENT MODAL (Manager Only)                  */}
      {/* ======================================================== */}
      {showCategoryModal && (
        <div 
          onClick={() => { setShowCategoryModal(false); setCatError(''); setCatSuccess(''); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div 
            className="glass-panel modal-responsive-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
          >
            <button
              onClick={() => setShowCategoryModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Category Management
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Categories group stock items across warehouses. Categories containing items cannot be deleted.
            </p>

            {catError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '0.6rem 0.85rem',
                borderRadius: 8,
                fontSize: '0.825rem',
                marginBottom: '1rem'
              }}>
                {catError}
              </div>
            )}

            {catSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                padding: '0.6rem 0.85rem',
                borderRadius: 8,
                fontSize: '0.825rem',
                marginBottom: '1rem'
              }}>
                {catSuccess}
              </div>
            )}

            {/* Create Category Form */}
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name..."
                className="form-input"
                style={{ fontSize: '0.85rem' }}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', flexShrink: 0 }}>
                <Plus size={16} />
                Add
              </button>
            </form>

            {/* Existing Categories List */}
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Existing Categories ({categories.length})
              </div>

              {categories.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 8,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '0.35rem'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{cat.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {cat._count?.items || 0} item(s) assigned
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    disabled={(cat._count?.items || 0) > 0}
                    className="btn btn-secondary"
                    title={(cat._count?.items || 0) > 0 ? 'Cannot delete category with items' : 'Delete category'}
                    style={{
                      padding: '0.35rem 0.55rem',
                      opacity: (cat._count?.items || 0) > 0 ? 0.35 : 1,
                      cursor: (cat._count?.items || 0) > 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Trash2 size={14} color="#f87171" />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button onClick={() => setShowCategoryModal(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
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
  Trash2 
} from 'lucide-react';

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

  // Catalog State
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [timelineItem, setTimelineItem] = useState<Item | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<ItemTimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

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

  const fetchItems = async () => {
    try {
      setLoading(true);
      let query = `/items?includeArchived=true`;
      if (selectedCategory !== 'all') {
        query += `&categoryId=${selectedCategory}`;
      }
      if (searchQuery.trim()) {
        query += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const data = await apiFetch<Item[]>(query);
      setItems(data);
    } catch (err: any) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, archiveFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

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

  // Open Timeline Drawer
  const openTimeline = async (item: Item) => {
    setTimelineItem(item);
    setLoadingTimeline(true);
    try {
      const res = await apiFetch<{ timeline: ItemTimelineEvent[] }>(`/items/${item.id}/timeline`);
      setTimelineEvents(res.timeline);
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

  // Filter items by active/archived state (memoized for performance)
  const displayedItems = useMemo(() => {
    return items.filter(item => {
      if (archiveFilter === 'active') return !item.isArchived;
      if (archiveFilter === 'archived') return item.isArchived;
      return true;
    });
  }, [items, archiveFilter]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1rem' }}>
      
      {/* Top Header & Overview */}
      <div className="catalog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
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
        <div className="catalog-header-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isManager && (
            <>
              <button 
                onClick={() => setShowCategoryModal(true)} 
                className="btn btn-secondary catalog-action-btn"
                style={{ fontSize: '0.85rem' }}
              >
                <Layers size={16} />
                Categories ({categories.length})
              </button>

              <button 
                onClick={handleOpenAdd} 
                className="btn btn-primary catalog-action-btn"
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

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 260px', maxWidth: 480, minWidth: 0 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU, item name, or description..."
                className="form-input"
                style={{ paddingLeft: '2.25rem', fontSize: '0.875rem' }}
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.55rem 0.9rem', flexShrink: 0 }}>
              Search
            </button>
          </form>

          {/* Active / Archived Pill Selector */}
          <div className="filter-segmented-group" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface-elevated)', borderRadius: 8, padding: '0.2rem', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setArchiveFilter('active')}
              className="filter-segment-btn"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: archiveFilter === 'active' ? 'var(--accent-primary)' : 'transparent',
                color: archiveFilter === 'active' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              Active Items
            </button>
            <button
              onClick={() => setArchiveFilter('archived')}
              className="filter-segment-btn"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: archiveFilter === 'archived' ? 'var(--accent-primary)' : 'transparent',
                color: archiveFilter === 'archived' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              Archived Items
            </button>
            <button
              onClick={() => setArchiveFilter('all')}
              className="filter-segment-btn"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: archiveFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
                color: archiveFilter === 'all' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              All
            </button>
          </div>
        </div>

        {/* Category Dropdown Selector (User Requested) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={16} color="var(--accent-primary)" />
            <label htmlFor="category-select" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Category
            </label>
          </div>

          <div style={{ minWidth: 180, maxWidth: 340, flex: '0 1 340px' }}>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="form-input"
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600,
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                color: 'var(--text-primary)'
              }}
            >
              <option value="all">All Categories ({items.length} total items)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} {cat._count?.items !== undefined ? `(${cat._count.items})` : ''}
                </option>
              ))}
            </select>
          </div>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}>
          {displayedItems.map((item) => (
            <div 
              key={item.id} 
              className="glass-panel item-card"
              style={{
                opacity: item.isArchived ? 0.75 : 1,
                border: item.isArchived ? '1px dashed rgba(148, 163, 184, 0.3)' : undefined,
              }}
            >
              {/* Card Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="sku-pill">
                    {item.sku}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-muted)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {item.category.name}
                    </span>
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
                <div className="item-spec-box">
                  <div>
                    <div className="item-spec-label">
                      Unit of Measure
                    </div>
                    <div className="item-spec-value">
                      {item.uom}
                    </div>
                  </div>

                  <div>
                    <div className="item-spec-label">
                      Reorder Threshold
                    </div>
                    <div className="item-spec-value" style={{ color: '#f59e0b' }}>
                      {item.reorderLevel} {item.uom}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', gap: '0.4rem' }}>
                <button
                  onClick={() => openTimeline(item)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.775rem', padding: '0.35rem 0.65rem', gap: '0.35rem' }}
                >
                  <History size={14} color="var(--accent-primary)" />
                  Timeline Log
                </button>

                {isManager && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="btn btn-secondary"
                      title="Edit item specifications"
                      style={{ padding: '0.35rem 0.55rem' }}
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={() => handleToggleArchive(item)}
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
            className="glass-panel modal-responsive-panel" 
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
                <History size={20} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Immutable Audit Timeline
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {timelineItem.sku}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontWeight: 600 }}>{timelineItem.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span className="badge" style={{ background: 'var(--bg-surface-elevated)' }}>
                  {timelineItem.category.name}
                </span>
              </div>
            </div>

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

            {/* Timeline Stream (Scrollable with hidden horizontal overflow) */}
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
                <div className="timeline-stream-container" style={{ position: 'relative', paddingLeft: '1.25rem', borderLeft: '2px solid rgba(99, 102, 241, 0.25)', marginLeft: '0.5rem', minWidth: 0 }}>
                  {timelineEvents.map((ev) => {
                    const isCreated = ev.eventType === 'CREATED';
                    const isFieldChange = ev.eventType === 'FIELD_CHANGE';
                    const isNote = ev.eventType === 'NOTE';
                    const dateStr = new Date(ev.createdAt).toLocaleString();

                    return (
                      <div key={ev.id} style={{ position: 'relative', marginBottom: '1rem', minWidth: 0 }}>
                        {/* Dot indicator */}
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

                        {/* Event Card */}
                        <div className="timeline-event-card">
                          {/* Card Header (Two-row responsive hierarchy: Badges on Row 1, Full User Name on Row 2) */}
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

                          {/* Event Content */}
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

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Immutable Audit Log: Records cannot be altered or deleted.
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

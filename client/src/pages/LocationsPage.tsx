import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { 
  Plus, 
  Users, 
  CheckCircle2, 
  ShieldAlert, 
  UserCheck, 
  Building2,
  X,
  AlertCircle
} from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LocationItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  assignedStaff: StaffUser[];
  isAssignedToCurrentUser: boolean;
}

export const LocationsPage: React.FC = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [allUsers, setAllUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');

  const [selectedLocationForStaff, setSelectedLocationForStaff] = useState<LocationItem | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const isManager = user?.role === 'MANAGER';

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ locations: LocationItem[] }>('/locations');
      setLocations(data.locations);

      if (isManager) {
        const usersData = await apiFetch<{ users: StaffUser[] }>('/auth/users');
        // Filter to only staff members for location assignments
        setAllUsers(usersData.users.filter((u) => u.role === 'STAFF'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [user]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/locations', {
        method: 'POST',
        body: JSON.stringify({ name: newLocName, code: newLocCode }),
      });
      setShowCreateModal(false);
      setNewLocName('');
      setNewLocCode('');
      await fetchLocations();
    } catch (err: any) {
      alert(err.message || 'Failed to create location.');
    }
  };

  const handleOpenAssignModal = (loc: LocationItem) => {
    setSelectedLocationForStaff(loc);
    setSelectedStaffIds(loc.assignedStaff.map((s) => s.id));
  };

  const handleSaveAssignments = async () => {
    if (!selectedLocationForStaff) return;
    try {
      await apiFetch(`/locations/${selectedLocationForStaff.id}/assign-staff`, {
        method: 'POST',
        body: JSON.stringify({ staffUserIds: selectedStaffIds }),
      });
      setSelectedLocationForStaff(null);
      await fetchLocations();
    } catch (err: any) {
      alert(err.message || 'Failed to update staff assignments.');
    }
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem 1.5rem' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Building2 size={26} color="var(--accent-primary)" />
            Locations & Staff Assignments
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Multi-location inventory tracking with strict server-enforced staff boundaries
          </p>
        </div>

        {isManager && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            Add New Location
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* RBAC Info Banner */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={20} color={isManager ? '#c084fc' : '#34d399'} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {isManager 
                ? 'Manager View: You have global authority to create locations and manage staff assignments.'
                : 'Warehouse Staff View: You can only record receipts, issues, and transfers at locations you are assigned to.'
              }
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Permissions are strictly validated on the server for all database ledger operations.
            </div>
          </div>
        </div>
        <span className={isManager ? 'badge badge-manager' : 'badge badge-staff'}>
          {user?.role} Access Mode
        </span>
      </div>

      {/* Location Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          Loading locations...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {locations.map((loc) => (
            <div key={loc.id} className="glass-panel card-hover" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 6, background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                      {loc.code}
                    </span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.5rem' }}>{loc.name}</h3>
                  </div>
                  {loc.isAssignedToCurrentUser ? (
                    <span className="badge badge-staff" title="You are authorized to record movements here">
                      <CheckCircle2 size={12} />
                      Authorized
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                      Not Assigned
                    </span>
                  )}
                </div>

                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Users size={14} />
                      Assigned Warehouse Staff ({loc.assignedStaff.length})
                    </div>
                  </div>

                  {loc.assignedStaff.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No staff assigned yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {loc.assignedStaff.map((staff) => (
                        <span key={staff.id} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <UserCheck size={12} color="#34d399" />
                          {staff.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {isManager && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => handleOpenAssignModal(loc)} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }}>
                    <Users size={14} />
                    Manage Staff Assignments
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Location */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add New Warehouse Location</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  Location Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Southside Distribution Center"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  Location Code (Unique Identifier)
                </label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="e.g. WH-SOUTH"
                  value={newLocCode}
                  onChange={(e) => setNewLocCode(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Staff Assignments */}
      {selectedLocationForStaff && (
        <div className="modal-overlay" onClick={() => setSelectedLocationForStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Staff Assignments</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Select staff members responsible for <strong>{selectedLocationForStaff.name}</strong> ({selectedLocationForStaff.code})
                </p>
              </div>
              <button onClick={() => setSelectedLocationForStaff(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto', marginBottom: '1.5rem' }}>
              {allUsers.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No staff members found.</div>
              ) : (
                allUsers.map((staff) => {
                  const isSelected = selectedStaffIds.includes(staff.id);
                  return (
                    <div
                      key={staff.id}
                      onClick={() => toggleStaffSelection(staff.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderRadius: 8,
                        background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{staff.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{staff.email}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setSelectedLocationForStaff(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveAssignments} className="btn btn-primary">
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

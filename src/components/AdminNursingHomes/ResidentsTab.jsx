import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchResidents,
  fetchFacilitiesList,
  createResident,
  updateResident,
  deleteResident
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './AdminNursingHomes.scss';

const ResidentsTab = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [facilities, setFacilities] = useState([]);
  const [residents, setResidents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facilityFilter, setFacilityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    facilityId: '',
    name: '',
    roomNumber: '',
    dietaryRestrictions: '',
    allergies: '',
    notes: ''
  });

  const loadFacilities = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetchFacilitiesList({ limit: 200 });
      setFacilities(res?.data || []);
    } catch {
      setFacilities([]);
    }
  }, [isAdmin]);

  const loadResidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: 1, limit: 50, isActive: 'true' };
      if (isAdmin && facilityFilter) params.facilityId = facilityFilter;
      if (search.trim()) params.search = search.trim();
      const res = await fetchResidents(params);
      const body = res?.data;
      const list = body?.data;
      setResidents(Array.isArray(list) ? list : []);
      setPagination(body?.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load residents');
      setResidents([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, facilityFilter, search]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);

  const handleOpenAdd = () => {
    setEditingResident(null);
    setForm({
      facilityId: isAdmin ? (facilityFilter || (facilities[0]?.id || '')) : user?.nursingHomeFacilityId || '',
      name: '',
      roomNumber: '',
      dietaryRestrictions: '',
      allergies: '',
      notes: ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (r) => {
    setEditingResident(r);
    setForm({
      facilityId: r.facilityId,
      name: r.name || '',
      roomNumber: r.roomNumber || '',
      dietaryRestrictions: r.dietaryRestrictions || '',
      allergies: r.allergies || '',
      notes: r.notes || ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.facilityId && isAdmin) {
      setError('Please select a facility');
      return;
    }
    const facilityId = form.facilityId || user?.nursingHomeFacilityId;
    if (!facilityId) {
      setError('Facility is required');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        facilityId,
        name: form.name.trim(),
        roomNumber: form.roomNumber.trim() || undefined,
        dietaryRestrictions: form.dietaryRestrictions.trim() || undefined,
        allergies: form.allergies.trim() || undefined,
        notes: form.notes.trim() || undefined
      };
      if (editingResident) {
        await updateResident(editingResident.id, payload);
      } else {
        await createResident(payload);
      }
      setModalOpen(false);
      setEditingResident(null);
      loadResidents();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save resident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (r) => setDeleteConfirm(r);
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      setSubmitting(true);
      setError(null);
      await deleteResident(deleteConfirm.id);
      setDeleteConfirm(null);
      loadResidents();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to deactivate resident');
    } finally {
      setSubmitting(false);
    }
  };

  const facilityName = (id) => facilities.find(f => f.id === id)?.name || id;

  return (
    <div className="residents-tab">
      <div className="tab-header">
        <h2>Residents</h2>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          Add Resident
        </button>
      </div>

      {isAdmin && facilities.length > 0 && (
        <div className="filters-row">
          <label>
            <span>Facility</span>
            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
            >
              <option value="">All facilities</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input
              type="text"
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      )}

      {error && !modalOpen && !deleteConfirm && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : residents.length === 0 ? (
        <div className="content-placeholder">
          <p>No residents found.</p>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            Add Resident
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table" role="grid">
            <thead>
              <tr>
                {isAdmin && <th>Facility</th>}
                <th>Name</th>
                <th>Room</th>
                <th>Dietary / Allergies</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => (
                <tr key={r.id}>
                  {isAdmin && <td>{r.facility ? r.facility.name : facilityName(r.facilityId)}</td>}
                  <td>{r.name}</td>
                  <td>{r.roomNumber || '—'}</td>
                  <td>
                    {[r.dietaryRestrictions, r.allergies].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => handleOpenEdit(r)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger btn-sm" onClick={() => handleDeleteClick(r)}>
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => !submitting && setDeleteConfirm(null)}>
          <div className="modal-content facilities-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Deactivate resident</h3>
            <p>Deactivate &quot;{deleteConfirm.name}&quot;? They will no longer appear in active lists.</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={handleDeleteConfirm} disabled={submitting}>
                {submitting ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setModalOpen(false)}>
          <div className="modal-content facilities-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingResident ? 'Edit Resident' : 'Add Resident'}</h3>
            {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
            <form onSubmit={handleSubmit}>
              {isAdmin && (
                <label>
                  <span>Facility *</span>
                  <select
                    value={form.facilityId}
                    onChange={(e) => setForm(prev => ({ ...prev, facilityId: e.target.value }))}
                    required
                  >
                    <option value="">Select facility</option>
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span>Name *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Resident name"
                  required
                />
              </label>
              <label>
                <span>Room number</span>
                <input
                  type="text"
                  value={form.roomNumber}
                  onChange={(e) => setForm(prev => ({ ...prev, roomNumber: e.target.value }))}
                  placeholder="e.g. 101"
                />
              </label>
              <label>
                <span>Dietary restrictions</span>
                <input
                  type="text"
                  value={form.dietaryRestrictions}
                  onChange={(e) => setForm(prev => ({ ...prev, dietaryRestrictions: e.target.value }))}
                  placeholder="e.g. Low sodium"
                />
              </label>
              <label>
                <span>Allergies</span>
                <input
                  type="text"
                  value={form.allergies}
                  onChange={(e) => setForm(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder="e.g. Nuts, shellfish"
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes"
                  rows={2}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => !submitting && setModalOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : (editingResident ? 'Save' : 'Create Resident')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentsTab;

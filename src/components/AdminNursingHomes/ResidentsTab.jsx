import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  fetchResidents,
  fetchFacilitiesList,
  createResident,
  updateResident,
  deleteResident,
  deleteResidentPermanently
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NotificationToast from '../NotificationToast/NotificationToast';
import './AdminNursingHomes.scss';

const ResidentsTab = () => {
  const { user } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  const isAdmin = user?.role === 'admin';
  const [facilities, setFacilities] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facilityFilter, setFacilityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewResident, setViewResident] = useState(null);
  const [editingResident, setEditingResident] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState(null);
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
      const params = { page, limit: 50, isActive: 'true' };
      if (isAdmin && facilityFilter) params.facilityId = facilityFilter;
      if (search.trim()) params.search = search.trim();
      const res = await fetchResidents(params);
      const list = res?.data;
      setResidents(Array.isArray(list) ? list : []);
      setPagination(res?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err?.message || err.response?.data?.message || err.response?.data?.error || 'Failed to load residents');
      setResidents([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, facilityFilter, search, page]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);

  useEffect(() => {
    setPage(1);
  }, [facilityFilter, search]);

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
    if (!editingResident && !form.roomNumber.trim()) {
      setError('Room number is required');
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
        showNotification('Resident updated successfully.', 'success');
      } else {
        await createResident(payload);
        showNotification('Resident created successfully.', 'success');
      }
      setModalOpen(false);
      setEditingResident(null);
      loadResidents();
    } catch (err) {
      setError(err?.message || err.response?.data?.message || err.response?.data?.error || 'Failed to save resident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveClick = (r) => setArchiveConfirm(r);
  const handleArchiveConfirm = async () => {
    if (!archiveConfirm) return;
    try {
      setSubmitting(true);
      setError(null);
      await deleteResident(archiveConfirm.id);
      showNotification('Resident archived.', 'success');
      setArchiveConfirm(null);
      loadResidents();
    } catch (err) {
      setError(err?.message || err.response?.data?.message || err.response?.data?.error || 'Failed to archive resident');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePermanentDeleteClick = (r) => setPermanentDeleteConfirm(r);
  const handlePermanentDeleteConfirm = async () => {
    if (!permanentDeleteConfirm) return;
    try {
      setSubmitting(true);
      setError(null);
      await deleteResidentPermanently(permanentDeleteConfirm.id);
      showNotification('Resident deleted permanently.', 'success');
      setPermanentDeleteConfirm(null);
      loadResidents();
    } catch (err) {
      const msg = err?.message || err.response?.data?.error || 'Failed to delete resident';
      setError(msg);
      showNotification(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const facilityName = (id) => facilities.find(f => f.id === id)?.name || id;

  return (
    <div className="residents-tab">
      <NotificationToast notification={notification} onClose={hideNotification} />
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

      {error && !modalOpen && !viewResident && !archiveConfirm && !permanentDeleteConfirm && (
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
        <div className="nursing-table-container">
          <div className="nursing-table-scroll">
            <table className="data-table" role="grid">
              <thead>
                <tr>
                  {isAdmin && <th scope="col">Facility</th>}
                  <th scope="col">Name</th>
                  <th scope="col">Room</th>
                  <th scope="col">Dietary restrictions</th>
                  <th scope="col">Allergies</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => (
                  <tr key={r.id}>
                    {isAdmin && <td>{r.facility ? r.facility.name : facilityName(r.facilityId)}</td>}
                    <td>{r.name}</td>
                    <td>{r.roomNumber || '—'}</td>
                    <td>{r.dietaryRestrictions || '—'}</td>
                    <td>{r.allergies || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="view-btn" onClick={() => setViewResident(r)}>
                          View
                        </button>
                        <button type="button" className="edit-btn" onClick={() => handleOpenEdit(r)}>
                          Edit
                        </button>
                        <button type="button" className="archive-btn" onClick={() => handleArchiveClick(r)}>
                          Archive
                        </button>
                        <button type="button" className="delete-btn" onClick={() => handlePermanentDeleteClick(r)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && residents.length > 0 && (pagination.totalPages > 1 || pagination.total > pagination.limit) && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {pagination.total > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} residents
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="page-info">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {viewResident && (
        <div className="admin-nursing-homes__overlay" onClick={() => setViewResident(null)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--view" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>Resident Details</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => setViewResident(null)} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              <div className="admin-nursing-homes__overview">
                <h3>{viewResident.name}</h3>
                <div className="admin-nursing-homes__info-grid">
                  {isAdmin && (
                    <div className="admin-nursing-homes__info-item">
                      <label>Facility</label>
                      <span>{viewResident.facility ? viewResident.facility.name : facilityName(viewResident.facilityId)}</span>
                    </div>
                  )}
                  <div className="admin-nursing-homes__info-item">
                    <label>Room</label>
                    <span>{viewResident.roomNumber || '—'}</span>
                  </div>
                  <div className="admin-nursing-homes__info-item">
                    <label>Dietary restrictions</label>
                    <span>{viewResident.dietaryRestrictions || '—'}</span>
                  </div>
                  <div className="admin-nursing-homes__info-item">
                    <label>Allergies</label>
                    <span>{viewResident.allergies || '—'}</span>
                  </div>
                  {viewResident.notes && (
                    <div className="admin-nursing-homes__info-item admin-nursing-homes__info-item--full">
                      <label>Notes</label>
                      <span>{viewResident.notes}</span>
                    </div>
                  )}
                </div>
                <div className="admin-nursing-homes__form-actions">
                  <button type="button" onClick={() => setViewResident(null)}>Close</button>
                  <button type="button" className="btn-primary" onClick={() => { setViewResident(null); handleOpenEdit(viewResident); }}>
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {archiveConfirm && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && setArchiveConfirm(null)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>Archive resident</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => setArchiveConfirm(null)} disabled={submitting} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              <p className="admin-nursing-homes__description">
                Archive &quot;{archiveConfirm.name}&quot;? They will no longer appear in active lists. You can restore them later by editing the resident.
              </p>
              <div className="admin-nursing-homes__form-actions">
                <button type="button" onClick={() => setArchiveConfirm(null)} disabled={submitting}>Cancel</button>
                <button type="button" className="btn-archive" onClick={handleArchiveConfirm} disabled={submitting}>
                  {submitting ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {permanentDeleteConfirm && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && setPermanentDeleteConfirm(null)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>Delete resident permanently</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => { setPermanentDeleteConfirm(null); setError(null); }} disabled={submitting} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
              <p className="admin-nursing-homes__description">
                Permanently delete &quot;{permanentDeleteConfirm.name}&quot;? This cannot be undone. If they have any orders, archive them instead.
              </p>
              <div className="admin-nursing-homes__form-actions">
                <button type="button" onClick={() => { setPermanentDeleteConfirm(null); setError(null); }} disabled={submitting}>Cancel</button>
                <button type="button" className="btn-danger" onClick={handlePermanentDeleteConfirm} disabled={submitting}>
                  {submitting ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && setModalOpen(false)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>{editingResident ? 'Edit Resident' : 'Add Resident'}</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => !submitting && setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
              <form onSubmit={handleSubmit}>
                <div className="admin-nursing-homes__form-grid">
                  {isAdmin && (
                    <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                      <label>Facility *</label>
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
                    </div>
                  )}
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Resident name"
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>Room Number {!editingResident && '*'}</label>
                    <input
                      type="text"
                      value={form.roomNumber}
                      onChange={(e) => setForm(prev => ({ ...prev, roomNumber: e.target.value }))}
                      placeholder="e.g. 101"
                      required={!editingResident}
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Dietary Restrictions</label>
                    <input
                      type="text"
                      value={form.dietaryRestrictions}
                      onChange={(e) => setForm(prev => ({ ...prev, dietaryRestrictions: e.target.value }))}
                      placeholder="e.g. Low sodium"
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Allergies</label>
                    <input
                      type="text"
                      value={form.allergies}
                      onChange={(e) => setForm(prev => ({ ...prev, allergies: e.target.value }))}
                      placeholder="e.g. Nuts, shellfish"
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional notes"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="admin-nursing-homes__form-actions">
                  <button type="button" onClick={() => !submitting && setModalOpen(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : (editingResident ? 'Save' : 'Create Resident')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentsTab;

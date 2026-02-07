import { useState, useEffect, useCallback } from 'react';
import {
  getAdminMapsRestaurants,
  createAdminMapsRestaurant,
  updateAdminMapsRestaurant,
  deleteAdminMapsRestaurant,
  importAdminMapsRestaurantsCsv
} from '../../services/mapsService';
import { MapPin, Upload } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NotificationToast from '../NotificationToast/NotificationToast';
import { useNotification } from '../../hooks/useNotification';
import './AdminMaps.scss';

const DEACTIVATION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'closed_permanently', label: 'Closed permanently' },
  { value: 'closed_temporarily', label: 'Closed temporarily' },
  { value: 'other', label: 'Other' }
];

const DIET_TAG_OPTIONS = ['meat', 'dairy', 'parve', 'sushi', 'fish', 'vegan', 'vegetarian', 'bakery', 'pizza', 'deli'];

const AdminMaps = () => {
  const { notification, showNotification, hideNotification } = useNotification();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [filterDiet, setFilterDiet] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [viewingRow, setViewingRow] = useState(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    latitude: '',
    longitude: '',
    phone: '',
    website: '',
    kosherCertification: '',
    googleRating: '',
    dietTags: [],
    isActive: true,
    deactivationReason: '',
    hoursOfOperation: '',
    notes: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 50 };
      if (search.trim()) params.search = search.trim();
      if (filterActive === 'true') params.active = 'true';
      if (filterActive === 'false') params.active = 'false';
      if (filterDiet.trim()) params.diet = filterDiet.trim();
      const res = await getAdminMapsRestaurants(params);
      setList(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
    } catch (err) {
      const msg = err?.message || 'Failed to load map restaurants';
      setList([]);
      showNotification(msg, 'error');
      console.error('[AdminMaps] Load failed:', msg, err);
    } finally {
      setLoading(false);
    }
  // showNotification intentionally omitted to avoid request loop (it changes every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterActive, filterDiet]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      latitude: '',
      longitude: '',
      phone: '',
      website: '',
      kosherCertification: '',
      googleRating: '',
      dietTags: [],
      isActive: true,
      deactivationReason: '',
      hoursOfOperation: '',
      notes: ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.zip || '',
      latitude: row.latitude != null ? String(row.latitude) : '',
      longitude: row.longitude != null ? String(row.longitude) : '',
      phone: row.phone || '',
      website: row.website || '',
      kosherCertification: row.kosherCertification || '',
      googleRating: row.googleRating != null ? String(row.googleRating) : '',
      dietTags: Array.isArray(row.dietTags) ? [...row.dietTags] : [],
      isActive: row.isActive !== false,
      deactivationReason: row.deactivationReason || '',
      notes: row.notes || ''
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
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        kosherCertification: form.kosherCertification.trim() || null,
        googleRating: form.googleRating ? parseFloat(form.googleRating) : null,
        dietTags: form.dietTags,
        isActive: form.isActive,
        deactivationReason: form.deactivationReason || null,
        hoursOfOperation: form.hoursOfOperation.trim() || null,
        notes: form.notes.trim() || null
      };
      if (editing) {
        await updateAdminMapsRestaurant(editing.id, payload);
      } else {
        await createAdminMapsRestaurant(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const msg = err?.message || 'Failed to save';
      setError(null);
      showNotification(msg, 'error');
      console.error('[AdminMaps] Save failed:', msg, { error: err, editing: !!editing });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = (row) => {
    const nextActive = !row.isActive;
    setEditing(row);
    setForm({
      name: row.name || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.zip || '',
      latitude: row.latitude != null ? String(row.latitude) : '',
      longitude: row.longitude != null ? String(row.longitude) : '',
      phone: row.phone || '',
      website: row.website || '',
      kosherCertification: row.kosherCertification || '',
      googleRating: row.googleRating != null ? String(row.googleRating) : '',
      dietTags: Array.isArray(row.dietTags) ? [...row.dietTags] : [],
      isActive: nextActive,
      deactivationReason: nextActive ? '' : (row.deactivationReason || 'closed_temporarily'),
      notes: row.notes || ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleView = (row) => {
    setViewingRow(row);
  };

  const handleDeleteClick = (row) => {
    setRowToDelete(row);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rowToDelete) return;
    try {
      await deleteAdminMapsRestaurant(rowToDelete.id);
      setShowDeleteConfirm(false);
      setRowToDelete(null);
      load();
      showNotification('Restaurant deleted', 'success');
    } catch (err) {
      showNotification(err?.message || 'Failed to delete', 'error');
    }
  };

  const handleCsvImport = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importAdminMapsRestaurantsCsv(file);
      e.target.value = '';
      load();
      const created = result.created ?? 0;
      const updated = result.updated ?? 0;
      const errCount = result.errors?.length ?? 0;
      const msg = `${created} created, ${updated} updated${errCount ? `. ${errCount} row(s) skipped.` : '.'}`;
      showNotification(msg, 'success');
      if (result.errors?.length) {
        const byMessage = {};
        result.errors.forEach(({ row, message }) => {
          byMessage[message] = (byMessage[message] || []).concat(row);
        });
        const summary = Object.entries(byMessage)
          .map(([m, rows]) => `${rows.length}× ${m} (rows: ${rows.join(', ')})`)
          .join('; ');
        console.warn('[AdminMaps] Upload complete with row errors:', msg, '—', summary);
      } else {
        console.log('[AdminMaps] Upload complete:', msg);
      }
    } catch (err) {
      const msg = err?.message || 'Upload failed';
      showNotification(msg, 'error');
      console.error('[AdminMaps] Upload failed:', msg, { error: err, fileName: file?.name });
    } finally {
      setImporting(false);
    }
  };

  const toggleDietTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      dietTags: prev.dietTags.includes(tag)
        ? prev.dietTags.filter((t) => t !== tag)
        : [...prev.dietTags, tag]
    }));
  };

  const activeCount = list.filter((r) => r.isActive !== false).length;
  const inactiveCount = list.length - activeCount;

  return (
    <div className="admin-maps">
      <div className="maps-header">
        <div className="header-content">
          <h1>Kosher Maps – Restaurants</h1>
          <p>Manage the directory of kosher restaurants for My Kosher Maps.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="maps-btn-primary" onClick={handleOpenAdd}>
            Add Restaurant
          </button>
          <label className="maps-upload-label">
            <span className="maps-btn-secondary">
              <Upload size={18} className="maps-upload-icon" aria-hidden />
              {importing ? 'Uploading…' : 'Upload CSV / Excel'}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleCsvImport}
              disabled={importing}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total</span>
          <span className="stat-value">{pagination.total}</span>
        </div>
        <div className="stat-card stat-card--success">
          <span className="stat-label">Active</span>
          <span className="stat-value">{activeCount}</span>
        </div>
        <div className="stat-card stat-card--muted">
          <span className="stat-label">Inactive</span>
          <span className="stat-value">{inactiveCount}</span>
        </div>
      </div>

      <div className="maps-filters">
        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Name, address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Diet tag</label>
          <input
            type="text"
            placeholder="e.g. meat, dairy"
            value={filterDiet}
            onChange={(e) => setFilterDiet(e.target.value)}
          />
        </div>
      </div>

      <div className="maps-table-container">
        {loading ? (
          <div className="maps-loading">
            <LoadingSpinner size="large" />
            <p>Loading restaurants…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="maps-empty">
            <div className="maps-empty-icon" aria-hidden>
              <MapPin size={48} strokeWidth={1.5} />
            </div>
            <h2 className="maps-empty-title">No restaurants yet</h2>
            <p className="maps-empty-text">Add your first restaurant or upload a CSV or Excel file to build your map directory.</p>
            <div className="maps-empty-actions">
              <button type="button" className="maps-btn-primary" onClick={handleOpenAdd}>
                Add Restaurant
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="maps-table-scroll">
              <table className="maps-table" role="grid">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Diet</th>
                    <th>Certification</th>
                    <th>Phone</th>
                    <th>Rating</th>
                    <th>Active</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className={row.isActive === false ? 'maps-row--inactive' : ''}>
                      <td className="maps-name">{row.name}</td>
                      <td className="maps-address">{[row.address, row.city, row.state, row.zip].filter(Boolean).join(', ') || '—'}</td>
                      <td className="maps-diet">{(row.dietTags || []).join(', ') || '—'}</td>
                      <td className="maps-cert">{row.kosherCertification || '—'}</td>
                      <td className="maps-phone">{row.phone || '—'}</td>
                      <td className="maps-rating">{row.googleRating != null ? Number(row.googleRating).toFixed(1) : '—'}</td>
                      <td className="maps-active">
                        <span className={`maps-pill maps-pill--${row.isActive !== false ? 'success' : 'error'}`}>
                          {row.isActive !== false ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="maps-reason">{row.deactivationReason ? row.deactivationReason.replace(/_/g, ' ') : '—'}</td>
                      <td className="maps-actions">
                        <button type="button" className="maps-action maps-action--view" onClick={() => handleView(row)}>View</button>
                        <button type="button" className="maps-action maps-action--edit" onClick={() => handleOpenEdit(row)}>Edit</button>
                        <button
                          type="button"
                          className="maps-action maps-action--deactivate"
                          onClick={() => handleToggleActive(row)}
                        >
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="maps-action maps-action--delete" onClick={() => handleDeleteClick(row)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.length > 0 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {pagination.total > 0 ? ((pagination.page - 1) * (pagination.limit || 50)) + 1 : 0} to{' '}
                  {Math.min(pagination.page * (pagination.limit || 50), pagination.total)} of{' '}
                  {pagination.total || 0} restaurants
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
                    Page {pagination.page || 1} of {pagination.totalPages || 1}
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
          </>
        )}
      </div>

      {showDeleteConfirm && rowToDelete && (
        <div className="maps-delete-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="maps-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete restaurant?</h3>
            <p>“{rowToDelete.name}” will be removed from the map directory. This cannot be undone.</p>
            <div className="maps-delete-actions">
              <button type="button" className="maps-btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button type="button" className="maps-btn-danger" onClick={handleDeleteConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {viewingRow && (
        <div className="admin-maps__overlay" onClick={() => setViewingRow(null)}>
          <div className="admin-maps__modal admin-maps__modal--view" onClick={(e) => e.stopPropagation()}>
            <div className="admin-maps__modal-header">
              <h2>{viewingRow.name}</h2>
              <button
                type="button"
                className="admin-maps__modal-close"
                onClick={() => setViewingRow(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-maps__view-content">
              <dl className="admin-maps__view-grid">
                <dt>Address</dt>
                <dd>{[viewingRow.address, viewingRow.city, viewingRow.state, viewingRow.zip].filter(Boolean).join(', ') || '—'}</dd>

                <dt>Phone</dt>
                <dd>{viewingRow.phone || '—'}</dd>

                <dt>Website</dt>
                <dd>
                  {viewingRow.website ? (
                    <a href={viewingRow.website.startsWith('http') ? viewingRow.website : `https://${viewingRow.website}`} target="_blank" rel="noopener noreferrer">{viewingRow.website}</a>
                  ) : '—'}
                </dd>

                <dt>Kosher certification</dt>
                <dd>{viewingRow.kosherCertification || '—'}</dd>

                <dt>Google rating</dt>
                <dd>{viewingRow.googleRating != null ? Number(viewingRow.googleRating).toFixed(1) : '—'}</dd>

                <dt>Diet</dt>
                <dd>{(viewingRow.dietTags || []).join(', ') || '—'}</dd>

                <dt>Hours of operation</dt>
                <dd className="admin-maps__view-hours">{viewingRow.hoursOfOperation || '—'}</dd>

                <dt>Status</dt>
                <dd>
                  <span className={`maps-pill maps-pill--${viewingRow.isActive !== false ? 'success' : 'error'}`}>
                    {viewingRow.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                  {viewingRow.isActive === false && viewingRow.deactivationReason && (
                    <span className="admin-maps__view-reason"> ({viewingRow.deactivationReason.replace(/_/g, ' ')})</span>
                  )}
                </dd>

                {viewingRow.notes && (
                  <>
                    <dt>Notes</dt>
                    <dd>{viewingRow.notes}</dd>
                  </>
                )}

                <dt>Coordinates</dt>
                <dd>
                  {viewingRow.latitude != null && viewingRow.longitude != null
                    ? `${Number(viewingRow.latitude).toFixed(5)}, ${Number(viewingRow.longitude).toFixed(5)}`
                    : '—'}
                </dd>

                {viewingRow.googlePlaceId && (
                  <>
                    <dt>Google Place ID</dt>
                    <dd className="admin-maps__view-place-id">{viewingRow.googlePlaceId}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className="admin-maps__view-actions">
              <button type="button" className="maps-btn-secondary" onClick={() => setViewingRow(null)}>Close</button>
              <button type="button" className="maps-btn-primary" onClick={() => { setViewingRow(null); handleOpenEdit(viewingRow); }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="admin-maps__overlay" onClick={() => !submitting && setModalOpen(false)}>
          <div className="admin-maps__modal admin-maps__modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="admin-maps__modal-header">
              <h2>{editing ? 'Edit Restaurant' : 'Add Restaurant'}</h2>
              <button
                type="button"
                className="admin-maps__modal-close"
                onClick={() => !submitting && setModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-maps__modal-content">
              {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
              <form onSubmit={handleSubmit}>
                <div className="admin-maps__form-grid">
                  <div className="admin-maps__form-group admin-maps__form-group--full">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Restaurant name"
                      required
                    />
                  </div>
                  <div className="admin-maps__form-group admin-maps__form-group--full">
                    <label>Address</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>State</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                      placeholder="e.g. NY"
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>ZIP</label>
                    <input
                      type="text"
                      value={form.zip}
                      onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>Latitude</label>
                    <input
                      type="text"
                      value={form.latitude}
                      onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                      placeholder="e.g. 40.7128"
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>Longitude</label>
                    <input
                      type="text"
                      value={form.longitude}
                      onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                      placeholder="e.g. -74.0060"
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div className="admin-maps__form-group admin-maps__form-group--full">
                    <label>Website</label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                      placeholder="https://"
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>Kosher certification</label>
                    <input
                      type="text"
                      value={form.kosherCertification}
                      onChange={(e) => setForm((p) => ({ ...p, kosherCertification: e.target.value }))}
                    />
                  </div>
                  <div className="admin-maps__form-group">
                    <label>Google rating</label>
                    <input
                      type="text"
                      value={form.googleRating}
                      onChange={(e) => setForm((p) => ({ ...p, googleRating: e.target.value }))}
                      placeholder="e.g. 4.5"
                    />
                  </div>
                  <div className="admin-maps__form-group admin-maps__form-group--full">
                    <label>Diet tags</label>
                    <div className="admin-maps__tags">
                      {DIET_TAG_OPTIONS.map((tag) => (
                        <label key={tag} className="admin-maps__tag">
                          <input
                            type="checkbox"
                            checked={form.dietTags.includes(tag)}
                            onChange={() => toggleDietTag(tag)}
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="admin-maps__form-group">
                    <label className="admin-maps__checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                      />
                      Active (visible to subscribers)
                    </label>
                  </div>
                  {!form.isActive && (
                    <div className="admin-maps__form-group">
                      <label>Deactivation reason</label>
                      <select
                        value={form.deactivationReason}
                        onChange={(e) => setForm((p) => ({ ...p, deactivationReason: e.target.value }))}
                      >
                        {DEACTIVATION_OPTIONS.map((opt) => (
                          <option key={opt.value || 'none'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="admin-maps__form-group admin-maps__form-group--full">
                    <label>Hours of operation</label>
                    <textarea
                      value={form.hoursOfOperation}
                      onChange={(e) => setForm((p) => ({ ...p, hoursOfOperation: e.target.value }))}
                      placeholder="e.g. Sun–Thu 9am–9pm; Fri 9am–2pm; Closed Sat; AS 8pm"
                      rows={2}
                    />
                    <span className="admin-maps__form-hint">AS = After Shabbat (understood in community)</span>
                  </div>
                  <div className="admin-maps__form-group admin-maps__form-group--full">
                    <label>Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="admin-maps__form-actions">
                  <button type="button" onClick={() => !submitting && setModalOpen(false)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : editing ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <NotificationToast notification={notification} onClose={hideNotification} />
    </div>
  );
};

export default AdminMaps;

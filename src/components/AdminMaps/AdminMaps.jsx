import { useState, useEffect, useCallback } from 'react';
import {
  getAdminMapsRestaurants,
  createAdminMapsRestaurant,
  updateAdminMapsRestaurant,
  importAdminMapsRestaurantsCsv
} from '../../services/mapsService';
import { MapPin, Upload } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './AdminMaps.scss';

const DEACTIVATION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'closed_permanently', label: 'Closed permanently' },
  { value: 'closed_temporarily', label: 'Closed temporarily' },
  { value: 'other', label: 'Other' }
];

const DIET_TAG_OPTIONS = ['meat', 'dairy', 'parve', 'sushi', 'fish', 'vegan', 'vegetarian', 'bakery', 'pizza', 'deli'];

const AdminMaps = () => {
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
      setError(err?.message || 'Failed to load map restaurants');
      setList([]);
    } finally {
      setLoading(false);
    }
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
      setError(err?.message || 'Failed to save');
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

  const handleCsvImport = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importAdminMapsRestaurantsCsv(file);
      setImporting(false);
      e.target.value = '';
      load();
      alert(`Upload complete: ${result.created} created, ${result.updated} updated.${result.errors?.length ? ` ${result.errors.length} errors.` : ''}`);
    } catch (err) {
      setError(err?.message || 'Upload failed');
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

  return (
    <div className="admin-maps">
      <div className="admin-maps__header">
        <h1>Kosher Maps – Restaurants</h1>
        <p>Manage the directory of kosher restaurants for My Kosher Maps.</p>
      </div>

      <div className="admin-maps__toolbar">
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          Add Restaurant
        </button>
        <label className="admin-maps__upload-label">
          <span className="btn-secondary">
            <Upload size={18} className="admin-maps__upload-icon" aria-hidden />
            {importing ? 'Uploading…' : 'Upload'}
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            disabled={importing}
            style={{ display: 'none' }}
          />
        </label>
        <div className="admin-maps__filters">
          <input
            type="text"
            placeholder="Search name, address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-maps__search"
          />
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="admin-maps__filter"
          >
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <input
            type="text"
            placeholder="Diet tag"
            value={filterDiet}
            onChange={(e) => setFilterDiet(e.target.value)}
            className="admin-maps__filter-input"
          />
        </div>
      </div>

      {error && !modalOpen && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : list.length === 0 ? (
        <div className="admin-maps__empty">
          <div className="admin-maps__empty-icon" aria-hidden>
            <MapPin size={48} strokeWidth={1.5} />
          </div>
          <h2 className="admin-maps__empty-title">No restaurants yet</h2>
          <p className="admin-maps__empty-text">Add your first restaurant or upload a CSV to build your map directory.</p>
          <div className="admin-maps__empty-actions">
            <button type="button" className="admin-maps__empty-btn admin-maps__empty-btn--primary" onClick={handleOpenAdd}>
              Add Restaurant
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-maps__table-wrap">
          <table className="admin-maps__table data-table" role="grid">
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
                <tr key={row.id} className={row.isActive === false ? 'admin-maps__row--inactive' : ''}>
                  <td>{row.name}</td>
                  <td>{[row.address, row.city, row.state, row.zip].filter(Boolean).join(', ') || '—'}</td>
                  <td>{(row.dietTags || []).join(', ') || '—'}</td>
                  <td>{row.kosherCertification || '—'}</td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.googleRating != null ? row.googleRating : '—'}</td>
                  <td>{row.isActive ? 'Yes' : 'No'}</td>
                  <td>{row.deactivationReason ? row.deactivationReason.replace(/_/g, ' ') : '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="edit-btn" onClick={() => handleOpenEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={row.isActive ? 'archive-btn' : 'view-btn'}
                        onClick={() => handleToggleActive(row)}
                      >
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && list.length > 0 && pagination.totalPages > 1 && (
        <div className="admin-maps__pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>Page {page} of {pagination.totalPages}</span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
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
    </div>
  );
};

export default AdminMaps;

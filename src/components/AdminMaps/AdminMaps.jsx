import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getAdminMapsRestaurants,
  createAdminMapsRestaurant,
  updateAdminMapsRestaurant,
  deleteAdminMapsRestaurant,
  importAdminMapsRestaurantsCsv
} from '../../services/mapsService';
import { isOpenNow } from '../../utils/mapsHoursUtils';
import { MapPin, Upload, ChevronDown } from 'lucide-react';
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

function formatHoursLine(line) {
  const parts = line.split(/\b(Closed)\b/i);
  return parts.map((part, i) =>
    part.toLowerCase() === 'closed' ? (
      <strong key={i} className="maps-hours-closed">Closed</strong>
    ) : (
      part
    )
  );
}

const TIMEZONE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'America/New_York', label: 'Eastern (EST/EDT)' },
  { value: 'America/Chicago', label: 'Central (CST/CDT)' },
  { value: 'America/Denver', label: 'Mountain (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PST/PDT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Montreal', label: 'Montreal' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Jerusalem', label: 'Israel' },
  { value: 'UTC', label: 'UTC' }
];

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
  const [timezoneDropOpen, setTimezoneDropOpen] = useState(null);
  const timezoneDropRef = useRef(null);
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
    googlePlaceId: '',
    dietTags: [],
    isActive: true,
    deactivationReason: '',
    hoursOfOperation: '',
    timezone: '',
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
      googlePlaceId: '',
      dietTags: [],
      isActive: true,
      deactivationReason: '',
      hoursOfOperation: '',
      timezone: '',
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
      googlePlaceId: row.googlePlaceId || '',
      dietTags: Array.isArray(row.dietTags) ? [...row.dietTags] : [],
      isActive: row.isActive !== false,
      deactivationReason: row.deactivationReason || '',
      hoursOfOperation: row.hoursOfOperation || '',
      timezone: row.timezone || '',
      notes: row.notes || ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameTrimmed = (form.name != null && typeof form.name === 'string') ? form.name.trim() : '';
    if (!nameTrimmed) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const str = (v) => (v == null || typeof v !== 'string' ? '' : v.trim()) || null;
      const payload = {
        name: nameTrimmed,
        address: str(form.address),
        city: str(form.city),
        state: str(form.state),
        zip: str(form.zip),
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        phone: str(form.phone),
        website: str(form.website),
        kosherCertification: str(form.kosherCertification),
        googleRating: form.googleRating ? parseFloat(form.googleRating) : null,
        googlePlaceId: str(form.googlePlaceId) || null,
        dietTags: Array.isArray(form.dietTags) ? form.dietTags : [],
        isActive: form.isActive,
        deactivationReason: form.deactivationReason || null,
        hoursOfOperation: str(form.hoursOfOperation),
        timezone: str(form.timezone) || null,
        notes: str(form.notes)
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
      hoursOfOperation: row.hoursOfOperation || '',
      timezone: row.timezone || '',
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

  useEffect(() => {
    if (timezoneDropOpen == null) return;
    const close = (e) => {
      if (timezoneDropRef.current && !timezoneDropRef.current.contains(e.target)) {
        setTimezoneDropOpen(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [timezoneDropOpen]);

  const buildRowPayload = (row, overrides = {}) => ({
    name: row.name || '',
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zip: row.zip ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    kosherCertification: row.kosherCertification ?? null,
    googleRating: row.googleRating ?? null,
    googlePlaceId: row.googlePlaceId ?? null,
    dietTags: Array.isArray(row.dietTags) ? row.dietTags : [],
    isActive: row.isActive !== false,
    deactivationReason: row.deactivationReason || null,
    hoursOfOperation: row.hoursOfOperation ?? null,
    timezone: row.timezone ?? null,
    notes: row.notes ?? null,
    ...overrides
  });

  const handleTimezoneChange = async (row, newTimezone) => {
    setTimezoneDropOpen(null);
    try {
      const payload = buildRowPayload(row, { timezone: newTimezone || null });
      await updateAdminMapsRestaurant(row.id, payload);
      setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, timezone: newTimezone || null } : r)));
      showNotification('Timezone updated', 'success');
    } catch (err) {
      showNotification(err?.message || 'Update failed', 'error');
    }
  };

  const getTimezoneLabel = (value) => TIMEZONE_OPTIONS.find((o) => o.value === value)?.label || value || '—';

  const openStatusById = useMemo(() => {
    const out = {};
    list.forEach((row) => {
      const status = isOpenNow(
        row.hoursOfOperation ?? row.hours_of_operation ?? '',
        row.latitude ?? null,
        row.longitude ?? null,
        row.timezone ?? null
      );
      out[row.id] = status;
    });
    return out;
  }, [list]);

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

      <div className="maps-as-callout" role="note">
        <strong>AS = After Shabbat</strong>
        <span> (~1 hour after sunset at the restaurant’s location)</span>
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
                    <th>Open</th>
                    <th>Address</th>
                    <th>Lat</th>
                    <th>Lng</th>
                    <th>Diet</th>
                    <th>Certification</th>
                    <th>Phone</th>
                    <th>Website</th>
                    <th>Rating</th>
                    <th>Hours</th>
                    <th>Timezone</th>
                    <th>Active</th>
                    <th>Reason</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => {
                    const isOpen = openStatusById[row.id];
                    const openRowClass = isOpen === true ? 'maps-row--open' : isOpen === false ? 'maps-row--closed' : '';
                    return (
                    <tr
                      key={row.id}
                      className={`${row.isActive === false ? 'maps-row--inactive' : ''} ${openRowClass}`}
                    >
                      <td className="maps-name">{row.name}</td>
                      <td className="maps-open-now">
                        {isOpen !== undefined && isOpen !== null ? (
                          <span className={`maps-pill maps-pill--${isOpen ? 'success' : 'error'}`}>
                            {isOpen ? 'Open' : 'Closed'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="maps-address">{[row.address, row.city, row.state, row.zip].filter(Boolean).join(', ') || '—'}</td>
                      <td className="maps-lat">{row.latitude != null ? Number(row.latitude).toFixed(5) : '—'}</td>
                      <td className="maps-lng">{row.longitude != null ? Number(row.longitude).toFixed(5) : '—'}</td>
                      <td className="maps-diet">{(row.dietTags || []).join(', ') || '—'}</td>
                      <td className="maps-cert">{row.kosherCertification || '—'}</td>
                      <td className="maps-phone">{row.phone || '—'}</td>
                      <td className="maps-website" title={row.website || ''}>
                        {row.website ? (
                          <a href={row.website.startsWith('http') ? row.website : `https://${row.website}`} target="_blank" rel="noopener noreferrer">
                            {row.website.length > 35 ? `${row.website.slice(0, 35)}…` : row.website}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="maps-rating">{row.googleRating != null ? Number(row.googleRating).toFixed(1) : '—'}</td>
                      <td className="maps-hours">
                        {(row.hoursOfOperation || row.hours_of_operation) ? (
                          <div className="maps-hours-block">
                            {(row.hoursOfOperation || row.hours_of_operation)
                              .trim()
                              .split(/\n/)
                              .filter(Boolean)
                              .map((line, i) => (
                                <div key={i} className="maps-hours-line">{formatHoursLine(line.trim())}</div>
                              ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="maps-timezone">
                        <div
                          className={`admin-maps__pill-select-wrap ${timezoneDropOpen === row.id ? 'admin-maps__pill-select-wrap--open' : ''}`}
                          ref={timezoneDropOpen === row.id ? timezoneDropRef : null}
                        >
                          <button
                            type="button"
                            className="admin-maps__pill-select-trigger"
                            onClick={() => setTimezoneDropOpen((id) => (id === row.id ? null : row.id))}
                            aria-haspopup="listbox"
                            aria-expanded={timezoneDropOpen === row.id}
                            aria-label={`Timezone: ${getTimezoneLabel(row.timezone)}`}
                          >
                            <span className="admin-maps__pill-select-label">{getTimezoneLabel(row.timezone)}</span>
                            <ChevronDown size={14} className="admin-maps__pill-select-chevron" aria-hidden />
                          </button>
                          {timezoneDropOpen === row.id && (
                            <ul
                              className="admin-maps__pill-select-dropdown"
                              role="listbox"
                              aria-label="Select timezone"
                            >
                              {TIMEZONE_OPTIONS.map((opt) => (
                                <li
                                  key={opt.value || 'empty'}
                                  role="option"
                                  aria-selected={row.timezone === opt.value}
                                  className={`admin-maps__pill-select-option ${row.timezone === opt.value ? 'admin-maps__pill-select-option--selected' : ''}`}
                                  onClick={() => handleTimezoneChange(row, opt.value)}
                                >
                                  {opt.label}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                      <td className="maps-active">
                        <span className={`maps-pill maps-pill--${row.isActive !== false ? 'success' : 'error'}`}>
                          {row.isActive !== false ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="maps-reason">{row.deactivationReason ? row.deactivationReason.replace(/_/g, ' ') : '—'}</td>
                      <td className="maps-notes" title={row.notes || ''}>
                        {row.notes ? `${String(row.notes).slice(0, 20)}${row.notes.length > 20 ? '…' : ''}` : '—'}
                      </td>
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
                  ); })}
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

      {viewingRow && (() => {
        const viewIsOpen = isOpenNow(
          viewingRow.hoursOfOperation ?? viewingRow.hours_of_operation ?? '',
          viewingRow.latitude ?? null,
          viewingRow.longitude ?? null,
          viewingRow.timezone ?? null
        );
        const viewOpenClass = viewIsOpen === true ? 'admin-maps__modal--view-open' : viewIsOpen === false ? 'admin-maps__modal--view-closed' : '';
        return (
        <div className="admin-maps__overlay" onClick={() => setViewingRow(null)}>
          <div className={`admin-maps__modal admin-maps__modal--view ${viewOpenClass}`} onClick={(e) => e.stopPropagation()}>
            <div className="admin-maps__modal-header admin-maps__modal-header--view">
              <div className="admin-maps__modal-header-title-row">
                <h2>{viewingRow.name}</h2>
                {viewIsOpen !== undefined && viewIsOpen !== null && (
                  <span className={`maps-pill maps-pill--${viewIsOpen ? 'success' : 'error'}`}>
                    {viewIsOpen ? 'Open now' : 'Closed'}
                  </span>
                )}
              </div>
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
              <section className="admin-maps__view-section">
                <h3 className="admin-maps__view-section-title">Location</h3>
                <dl className="admin-maps__view-grid">
                  <dt>Address</dt>
                  <dd className={![viewingRow.address, viewingRow.city, viewingRow.state, viewingRow.zip].filter(Boolean).length ? 'admin-maps__view-empty' : ''}>
                    {[viewingRow.address, viewingRow.city, viewingRow.state, viewingRow.zip].filter(Boolean).join(', ') || '—'}
                  </dd>
                  <dt>Coordinates</dt>
                  <dd className={viewingRow.latitude == null || viewingRow.longitude == null ? 'admin-maps__view-empty' : ''}>
                    {viewingRow.latitude != null && viewingRow.longitude != null
                      ? `${Number(viewingRow.latitude).toFixed(5)}, ${Number(viewingRow.longitude).toFixed(5)}`
                      : '—'}
                  </dd>
                </dl>
              </section>

              <section className="admin-maps__view-section">
                <h3 className="admin-maps__view-section-title">Contact & details</h3>
                <dl className="admin-maps__view-grid">
                  <dt>Phone</dt>
                  <dd className={!viewingRow.phone ? 'admin-maps__view-empty' : ''}>{viewingRow.phone || '—'}</dd>
                  <dt>Website</dt>
                  <dd className={!viewingRow.website ? 'admin-maps__view-empty' : ''}>
                    {viewingRow.website ? (
                      <a href={viewingRow.website.startsWith('http') ? viewingRow.website : `https://${viewingRow.website}`} target="_blank" rel="noopener noreferrer">{viewingRow.website}</a>
                    ) : '—'}
                  </dd>
                  <dt>Kosher certification</dt>
                  <dd className={!viewingRow.kosherCertification ? 'admin-maps__view-empty' : ''}>{viewingRow.kosherCertification || '—'}</dd>
                  <dt>Google rating</dt>
                  <dd className={viewingRow.googleRating == null ? 'admin-maps__view-empty' : ''}>{viewingRow.googleRating != null ? Number(viewingRow.googleRating).toFixed(1) : '—'}</dd>
                  <dt>Diet</dt>
                  <dd className={!(viewingRow.dietTags || []).length ? 'admin-maps__view-empty' : ''}>{(viewingRow.dietTags || []).join(', ') || '—'}</dd>
                </dl>
              </section>

              <section className="admin-maps__view-section">
                <h3 className="admin-maps__view-section-title">Hours & status</h3>
                <dl className="admin-maps__view-grid">
                  <dt>Hours of operation</dt>
                  <dd className={!viewingRow.hoursOfOperation ? 'admin-maps__view-empty' : ''}>
                    {(viewingRow.hoursOfOperation || viewingRow.hours_of_operation) ? (
                      <div className="admin-maps__view-hours-block">
                        {(viewingRow.hoursOfOperation || viewingRow.hours_of_operation)
                          .trim()
                          .split(/\n/)
                          .filter(Boolean)
                          .map((line, i) => (
                            <div key={i} className="admin-maps__view-hours-line">{formatHoursLine(line.trim())}</div>
                          ))}
                      </div>
                    ) : '—'}
                  </dd>
                  <dt>Timezone</dt>
                  <dd className={!viewingRow.timezone ? 'admin-maps__view-empty' : ''}>{getTimezoneLabel(viewingRow.timezone)}</dd>
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
                </dl>
              </section>

              {(viewingRow.googlePlaceId) && (
                <section className="admin-maps__view-section">
                  <h3 className="admin-maps__view-section-title">Technical</h3>
                  <dl className="admin-maps__view-grid">
                    <dt>Google Place ID</dt>
                    <dd className="admin-maps__view-place-id">{viewingRow.googlePlaceId}</dd>
                  </dl>
                </section>
              )}
            </div>
            <div className="admin-maps__view-actions">
              <button type="button" className="maps-btn-secondary" onClick={() => setViewingRow(null)}>Close</button>
              <button type="button" className="maps-btn-primary" onClick={() => { setViewingRow(null); handleOpenEdit(viewingRow); }}>Edit</button>
            </div>
          </div>
        </div>
      ); })()}

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
                      type="text"
                      value={form.website}
                      onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                      placeholder="https:// (optional)"
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
                    <label>Google Place ID</label>
                    <input
                      type="text"
                      value={form.googlePlaceId}
                      onChange={(e) => setForm((p) => ({ ...p, googlePlaceId: e.target.value }))}
                      placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
                    />
                    <span className="admin-maps__form-hint">Optional. From Google Maps / Places API.</span>
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
                  <div className="admin-maps__form-group">
                    <label>Timezone</label>
                    <div
                      className={`admin-maps__pill-select-wrap ${timezoneDropOpen === 'form' ? 'admin-maps__pill-select-wrap--open' : ''}`}
                      ref={timezoneDropOpen === 'form' ? timezoneDropRef : null}
                    >
                      <button
                        type="button"
                        className="admin-maps__pill-select-trigger"
                        onClick={() => setTimezoneDropOpen((id) => (id === 'form' ? null : 'form'))}
                        aria-haspopup="listbox"
                        aria-expanded={timezoneDropOpen === 'form'}
                        aria-label={`Timezone: ${getTimezoneLabel(form.timezone)}`}
                      >
                        <span className="admin-maps__pill-select-label">{getTimezoneLabel(form.timezone)}</span>
                        <ChevronDown size={14} className="admin-maps__pill-select-chevron" aria-hidden />
                      </button>
                      {timezoneDropOpen === 'form' && (
                        <ul
                          className="admin-maps__pill-select-dropdown"
                          role="listbox"
                          aria-label="Select timezone"
                        >
                          {TIMEZONE_OPTIONS.map((opt) => (
                            <li
                              key={opt.value || 'empty'}
                              role="option"
                              aria-selected={form.timezone === opt.value}
                              className={`admin-maps__pill-select-option ${form.timezone === opt.value ? 'admin-maps__pill-select-option--selected' : ''}`}
                              onClick={() => {
                                setForm((p) => ({ ...p, timezone: opt.value }));
                                setTimezoneDropOpen(null);
                              }}
                            >
                              {opt.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="admin-maps__form-hint">For open/closed and AS (after Shabbat)</span>
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

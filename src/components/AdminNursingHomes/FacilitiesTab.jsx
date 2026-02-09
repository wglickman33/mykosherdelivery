import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFacilitiesList, createFacility, updateFacility, deleteFacility } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Pagination from '../Pagination/Pagination';
import './AdminNursingHomes.scss';

const defaultAddress = {
  street: '',
  city: '',
  state: 'NY',
  zip_code: ''
};

const formatPhone = (raw) => {
  if (!raw) return '—';
  const digits = String(raw).replace(/\D/g, '').slice(0, 10);
  if (digits.length < 10) return digits.length ? digits : '—';
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const FacilitiesTab = () => {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [form, setForm] = useState({
    name: '',
    address: { ...defaultAddress },
    contactEmail: '',
    contactPhone: '',
    logoUrl: ''
  });

  const total = facilities.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (safePage - 1) * limit;
  const pagedFacilities = facilities.slice(startIdx, startIdx + limit);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFacilitiesList({ limit: 500 });
      const list = res?.data;
      setFacilities(Array.isArray(list) ? list : []);
      if (res && res.success === false) {
        setError('Failed to load facilities');
      }
    } catch (err) {
      setFacilities([]);
      setError(err.response?.data?.message || 'Failed to load facilities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenAdd = () => {
    setEditingFacility(null);
    setForm({
      name: '',
      address: { ...defaultAddress },
      contactEmail: '',
      contactPhone: '',
      logoUrl: ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (f) => {
    setEditingFacility(f);
    setForm({
      name: f.name || '',
      address: f.address ? { ...defaultAddress, ...f.address } : { ...defaultAddress },
      contactEmail: f.contactEmail || '',
      contactPhone: f.contactPhone || '',
      logoUrl: f.logoUrl || ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleDeleteClick = (f) => {
    setDeleteConfirm(f);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      setSubmitting(true);
      setError(null);
      await deleteFacility(deleteConfirm.id);
      setDeleteConfirm(null);
      load();
      window.dispatchEvent(new CustomEvent('mkd-communities-refresh'));
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to deactivate facility');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    if (field.startsWith('address.')) {
      const key = field.split('.')[1];
      setForm((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value }
      }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.street?.trim() || !form.address.city?.trim() || !form.address.state?.trim() || !form.address.zip_code?.trim()) {
      setError('Name and full address are required');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        name: form.name.trim(),
        address: form.address,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined
      };
      if (editingFacility) {
        await updateFacility(editingFacility.id, payload);
      } else {
        await createFacility(payload);
      }
      setModalOpen(false);
      setEditingFacility(null);
      load();
      window.dispatchEvent(new CustomEvent('mkd-communities-refresh'));
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || (editingFacility ? 'Failed to update facility' : 'Failed to create facility'));
    } finally {
      setSubmitting(false);
    }
  };

  const addressLine = (f) => {
    const a = f.address;
    if (!a) return '—';
    const parts = [a.street, a.city, a.state, a.zip_code].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  };

  return (
    <div className="facilities-tab">
      <div className="facilities-header">
        <div className="header-content">
          <h1>Facilities</h1>
          <p>Manage nursing home facilities and their settings</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-primary facilities-add-btn" onClick={handleOpenAdd}>
            Add Facility
          </button>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-label">Total Facilities</span>
            <span className="stat-value">{total}</span>
          </div>
        </div>
      </div>

      {error && !modalOpen && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : facilities.length === 0 ? (
        <div className="content-placeholder">
          <p>No facilities yet. Create one to get started.</p>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            Add Facility
          </button>
        </div>
      ) : (
        <div className="facilities-table-container">
          <div className="facilities-table-scroll">
            <table className="facilities-table" role="grid">
              <colgroup>
                <col className="col-name" />
                <col className="col-address" />
                <col className="col-email" />
                <col className="col-phone" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedFacilities.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div className="facility-name-cell">
                      {f.logoUrl ? (
                        <img src={f.logoUrl} alt="" className="facility-logo-thumb" />
                      ) : (
                        <span className="facility-initials">
                          {(f.name || 'NH').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span>{f.name}</span>
                    </div>
                  </td>
                  <td>{addressLine(f)}</td>
                  <td>{f.contactEmail || '—'}</td>
                  <td className="facility-phone-cell">{formatPhone(f.contactPhone)}</td>
                  <td className="facility-actions-cell">
                    <div className="facility-actions">
                      <button
                        type="button"
                        className="facility-btn facility-btn-enter btn-sm"
                        onClick={() => navigate(`/nursing-homes/dashboard?facilityId=${f.id}`)}
                      >
                        Enter
                      </button>
                      <button
                        type="button"
                        className="facility-btn facility-btn-menu btn-sm"
                        onClick={() => navigate(`/nursing-homes/menu?facilityId=${f.id}`)}
                        title="View menu"
                      >
                        Menu
                      </button>
                      <button type="button" className="facility-btn facility-btn-edit btn-sm" onClick={() => handleOpenEdit(f)}>
                        Edit
                      </button>
                      <button type="button" className="facility-btn facility-btn-deactivate btn-sm" onClick={() => handleDeleteClick(f)}>
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-footer">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              rowsPerPage={limit}
              total={total}
              onPageChange={setPage}
              onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && setDeleteConfirm(null)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>Deactivate facility</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => setDeleteConfirm(null)} disabled={submitting} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              <p style={{ margin: '0 0 20px 0', color: 'rgba(6, 23, 87, 0.7)', lineHeight: 1.6 }}>
                Deactivate &quot;{deleteConfirm.name}&quot;? Staff and residents will need to be reassigned. This can be reverted later by editing the facility.
              </p>
              <div className="admin-nursing-homes__form-actions">
                <button type="button" onClick={() => setDeleteConfirm(null)} disabled={submitting}>Cancel</button>
                <button type="button" className="btn-danger" onClick={handleDeleteConfirm} disabled={submitting}>
                  {submitting ? 'Deactivating…' : 'Deactivate'}
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
              <h2>{editingFacility ? 'Edit Facility' : 'Add Facility'}</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => !submitting && setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
              <form onSubmit={handleSubmit}>
                <div className="admin-nursing-homes__form-grid">
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g. Sunrise Senior Living"
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Street *</label>
                    <input
                      type="text"
                      value={form.address.street}
                      onChange={(e) => handleChange('address.street', e.target.value)}
                      placeholder="123 Main St"
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      value={form.address.city}
                      onChange={(e) => handleChange('address.city', e.target.value)}
                      placeholder="Great Neck"
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>State *</label>
                    <input
                      type="text"
                      value={form.address.state}
                      onChange={(e) => handleChange('address.state', e.target.value)}
                      placeholder="NY"
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>Zip Code *</label>
                    <input
                      type="text"
                      value={form.address.zip_code}
                      onChange={(e) => handleChange('address.zip_code', e.target.value)}
                      placeholder="11021"
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Contact Email</label>
                    <input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => handleChange('contactEmail', e.target.value)}
                      placeholder="admin@facility.com"
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Contact Phone</label>
                    <input
                      type="tel"
                      value={form.contactPhone}
                      onChange={(e) => handleChange('contactPhone', e.target.value)}
                      placeholder="555-123-4567"
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Logo URL (Optional)</label>
                    <input
                      type="url"
                      value={form.logoUrl}
                      onChange={(e) => handleChange('logoUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="admin-nursing-homes__form-actions">
                  <button type="button" onClick={() => !submitting && setModalOpen(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? (editingFacility ? 'Saving…' : 'Creating…') : (editingFacility ? 'Save' : 'Create Facility')}
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

export default FacilitiesTab;

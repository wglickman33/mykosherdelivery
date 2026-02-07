import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchFacilitiesList,
  fetchCurrentFacility,
  createStaff,
  updateStaff,
  deleteStaff,
  bulkCreateStaff
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './AdminNursingHomes.scss';

const StaffTab = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'nursing_home_user',
    phone: ''
  });

  const currentFacilityId = selectedFacilityId || (isAdmin ? '' : user?.nursingHomeFacilityId);

  const loadFacilities = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetchFacilitiesList({ limit: 200 });
      setFacilities(res?.data || []);
    } catch {
      setFacilities([]);
    }
  }, [isAdmin]);

  const loadFacility = useCallback(async (id) => {
    if (!id) {
      setFacility(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCurrentFacility(id);
      const data = res?.data ?? res;
      setFacility(data ? { ...data, staff: data.staff || [] } : null);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load facility');
      setFacility(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    if (!isAdmin || facilities.length === 0) return;
    setSelectedFacilityId((prev) => {
      if (prev && facilities.some((f) => f.id === prev)) return prev;
      return facilities[0].id;
    });
  }, [isAdmin, facilities]);

  useEffect(() => {
    if (isAdmin) {
      if (!selectedFacilityId || facilities.length === 0) {
        setFacility(null);
        setLoading(false);
        return;
      }
      const fromList = facilities.find((f) => f.id === selectedFacilityId);
      setFacility(fromList ? { ...fromList, staff: [] } : null);
      setLoading(false);
      setError(null);
    } else {
      loadFacility(user?.nursingHomeFacilityId);
    }
  }, [isAdmin, selectedFacilityId, facilities, user?.nursingHomeFacilityId, loadFacility]);

  const staff = facility?.staff || [];

  const handleOpenAdd = () => {
    setEditingUser(null);
    setForm({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'nursing_home_user',
      phone: ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setForm({
      email: u.email,
      password: '',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      role: u.role || 'nursing_home_user',
      phone: u.phone || ''
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!editingUser && !form.password) {
      setError('Password is required for new staff');
      return;
    }
    if (!editingUser && !form.email?.trim()) {
      setError('Email is required');
      return;
    }
    const fid = currentFacilityId;
    if (!fid) {
      setError('Please select a facility');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      if (editingUser) {
        await updateStaff(fid, editingUser.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role,
          phone: form.phone.trim() || undefined
        });
      } else {
        await createStaff(fid, {
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role,
          phone: form.phone.trim() || undefined
        });
      }
      setModalOpen(false);
      setEditingUser(null);
      loadFacility(fid);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (u) => setDeleteConfirm(u);
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || !currentFacilityId) return;
    try {
      setSubmitting(true);
      setError(null);
      await deleteStaff(currentFacilityId, deleteConfirm.id);
      setDeleteConfirm(null);
      loadFacility(currentFacilityId);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to remove staff');
    } finally {
      setSubmitting(false);
    }
  };

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      header.forEach((h, j) => { row[h] = values[j] || ''; });
      rows.push(row);
    }
    return rows;
  };

  const mapCSVToStaff = (rows) => {
    return rows.map(r => ({
      email: r.email || r.mail,
      firstName: r.firstname || r['first_name'] || r.first || '',
      lastName: r.lastname || r['last_name'] || r.last || '',
      role: (r.role || 'nursing_home_user').toLowerCase().includes('admin') ? 'nursing_home_admin' : 'nursing_home_user',
      password: r.password || undefined,
      phone: r.phone || r.phone_number || undefined
    })).filter(s => s.email && s.firstName && s.lastName);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !currentFacilityId) return;
    setSubmitting(true);
    setUploadResult(null);
    setError(null);
    try {
      const text = await uploadFile.text();
      const rows = parseCSV(text);
      const staffList = mapCSVToStaff(rows);
      if (staffList.length === 0) {
        setError('No valid rows. CSV should have headers: email, firstName, lastName, role (optional).');
        setSubmitting(false);
        return;
      }
      const res = await bulkCreateStaff(currentFacilityId, staffList);
      setUploadResult(res?.data ?? res);
      setUploadFile(null);
      setUploadOpen(false);
      loadFacility(currentFacilityId);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="staff-tab">
      <div className="tab-header">
        <h2>Staff</h2>
        <div className="tab-header-actions">
          {isAdmin && (
            <select
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              className="facility-select"
            >
              <option value="">Select facility</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn-secondary" onClick={() => setUploadOpen(true)} disabled={!currentFacilityId}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenAdd} disabled={!currentFacilityId}>
            Add Staff
          </button>
        </div>
      </div>

      {error && !modalOpen && !deleteConfirm && !uploadOpen && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {uploadResult && (
        <div className="upload-result success">
          <p>Created: {uploadResult.created?.length ?? 0}. Skipped: {uploadResult.skipped?.length ?? 0}. Errors: {uploadResult.errors?.length ?? 0}.</p>
        </div>
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : !currentFacilityId ? (
        <div className="content-placeholder">
          <p>Select a facility to manage staff.</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="content-placeholder">
          <p>No staff for this facility yet.</p>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            Add Staff
          </button>
          <button type="button" className="btn-secondary" onClick={() => setUploadOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
        </div>
      ) : (
        <div className="nursing-table-container">
          <div className="nursing-table-scroll">
            <table className="data-table" role="grid">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id}>
                    <td>{[u.firstName, u.lastName].filter(Boolean).join(' ')}</td>
                    <td>{u.email}</td>
                    <td>{u.role === 'nursing_home_admin' ? 'Admin' : 'User'}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="edit-btn" onClick={() => handleOpenEdit(u)}>
                          Edit
                        </button>
                        <button type="button" className="delete-btn" onClick={() => handleDeleteClick(u)}>
                          Remove
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

      {viewUser && (
        <div className="admin-nursing-homes__overlay" onClick={() => setViewUser(null)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--view" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>Staff Details</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => setViewUser(null)} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              <div className="admin-nursing-homes__overview">
                <h3>{[viewUser.firstName, viewUser.lastName].filter(Boolean).join(' ') || 'Staff member'}</h3>
                <div className="admin-nursing-homes__info-grid">
                  <div className="admin-nursing-homes__info-item">
                    <label>Email</label>
                    <span>{viewUser.email}</span>
                  </div>
                  <div className="admin-nursing-homes__info-item">
                    <label>Role</label>
                    <span>{viewUser.role === 'nursing_home_admin' ? 'Admin' : 'User'}</span>
                  </div>
                  <div className="admin-nursing-homes__info-item">
                    <label>Phone</label>
                    <span>{viewUser.phone || '—'}</span>
                  </div>
                </div>
                <div className="admin-nursing-homes__form-actions">
                  <button type="button" onClick={() => setViewUser(null)}>Close</button>
                  <button type="button" className="btn-primary" onClick={() => { setViewUser(null); handleOpenEdit(viewUser); }}>
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && setDeleteConfirm(null)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>Remove staff</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => setDeleteConfirm(null)} disabled={submitting} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              <p className="admin-nursing-homes__description">
                Remove {deleteConfirm.firstName} {deleteConfirm.lastName} from this facility? They will no longer have access.
              </p>
              <div className="admin-nursing-homes__form-actions">
                <button type="button" onClick={() => setDeleteConfirm(null)} disabled={submitting}>Cancel</button>
                <button type="button" className="btn-danger" onClick={handleDeleteConfirm} disabled={submitting}>
                  {submitting ? 'Removing…' : 'Remove'}
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
              <h2>{editingUser ? 'Edit Staff' : 'Add Staff'}</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => !submitting && setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
              <form onSubmit={handleSubmit}>
                <div className="admin-nursing-homes__form-grid">
                  {!editingUser && (
                    <>
                      <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                        <label>Email *</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="staff@facility.com"
                          required
                        />
                      </div>
                      <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                        <label>Password *</label>
                        <input
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Min 8 characters"
                          minLength={8}
                          required={!editingUser}
                        />
                      </div>
                    </>
                  )}
                  <div className="admin-nursing-homes__form-group">
                    <label>First name *</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>Last name *</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                    >
                      <option value="nursing_home_user">User</option>
                      <option value="nursing_home_admin">Admin</option>
                    </select>
                  </div>
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="admin-nursing-homes__form-actions">
                  <button type="button" onClick={() => !submitting && setModalOpen(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : (editingUser ? 'Save' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && setUploadOpen(false)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>Upload staff (CSV)</h2>
              <button type="button" className="admin-nursing-homes__modal-close" onClick={() => setUploadOpen(false)} disabled={submitting} aria-label="Close">×</button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              <p style={{ margin: '0 0 16px 0', color: 'rgba(6, 23, 87, 0.7)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                Upload a CSV with columns: <strong>email</strong>, <strong>firstName</strong>, <strong>lastName</strong>, <strong>role</strong> (nursing_home_user or nursing_home_admin). Optional: password, phone.
              </p>
              {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
              <form onSubmit={handleUploadSubmit}>
                <div className="admin-nursing-homes__form-grid">
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>CSV file</label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setUploadFile(e.target.files?.[0])}
                    />
                  </div>
                </div>
                <div className="admin-nursing-homes__form-actions">
                  <button type="button" onClick={() => setUploadOpen(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting || !uploadFile}>
                    {submitting ? 'Uploading…' : 'Upload'}
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

export default StaffTab;

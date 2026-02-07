import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchFacility,
  fetchFacilitiesList,
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
      const res = await fetchFacility(id);
      setFacility(res?.data ?? res);
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

  // When facilities load and there's exactly one (or we have none selected), auto-select so Add Staff / Upload aren't stuck disabled
  useEffect(() => {
    if (!isAdmin || facilities.length === 0) return;
    setSelectedFacilityId((prev) => {
      if (prev && facilities.some((f) => f.id === prev)) return prev;
      return facilities[0].id;
    });
  }, [isAdmin, facilities]);

  useEffect(() => {
    if (isAdmin) {
      loadFacility(selectedFacilityId);
    } else {
      loadFacility(user?.nursingHomeFacilityId);
    }
  }, [isAdmin, selectedFacilityId, user?.nursingHomeFacilityId, loadFacility]);

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
            Upload spreadsheet
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
            Upload spreadsheet
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table" role="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Phone</th>
                <th aria-label="Actions" />
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
                      <button type="button" className="btn-secondary btn-sm" onClick={() => handleOpenEdit(u)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger btn-sm" onClick={() => handleDeleteClick(u)}>
                        Remove
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
            <h3>Remove staff</h3>
            <p>Remove {deleteConfirm.firstName} {deleteConfirm.lastName} from this facility? They will no longer have access.</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={handleDeleteConfirm} disabled={submitting}>
                {submitting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setModalOpen(false)}>
          <div className="modal-content facilities-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingUser ? 'Edit Staff' : 'Add Staff'}</h3>
            {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
            <form onSubmit={handleSubmit}>
              {!editingUser && (
                <>
                  <label>
                    <span>Email *</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="staff@facility.com"
                      required
                    />
                  </label>
                  <label>
                    <span>Password *</span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Min 8 characters"
                      minLength={8}
                      required={!editingUser}
                    />
                  </label>
                </>
              )}
              <label>
                <span>First name *</span>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Last name *</span>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="nursing_home_user">User</option>
                  <option value="nursing_home_admin">Admin</option>
                </select>
              </label>
              <label>
                <span>Phone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => !submitting && setModalOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : (editingUser ? 'Save' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {uploadOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setUploadOpen(false)}>
          <div className="modal-content facilities-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Upload staff (CSV)</h3>
            <p>Upload a CSV with columns: <strong>email</strong>, <strong>firstName</strong>, <strong>lastName</strong>, <strong>role</strong> (nursing_home_user or nursing_home_admin). Optional: password, phone.</p>
            {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
            <form onSubmit={handleUploadSubmit}>
              <label>
                <span>CSV file</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0])}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setUploadOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting || !uploadFile}>
                  {submitting ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffTab;

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchResidents,
  fetchFacilitiesList,
  fetchStaffForFacility,
  createResident,
  updateResident,
  deactivateResident,
  permanentlyDeleteResident,
  saveResidentPaymentMethod
} from '../../services/nursingHomeService';
import { stripePromise, createPaymentMethod } from '../../services/paymentServices';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Pagination from '../Pagination/Pagination';
import './AdminNursingHomes.scss';

const cardElementOptions = {
  style: {
    base: { fontSize: '16px', color: '#1e293b', '::placeholder': { color: '#94a3b8' } },
    invalid: { color: '#dc2626' }
  }
};

const formatAssignedStaffName = (user) => {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || null;
};

const emptyForm = {
  facilityId: '',
  name: '',
  roomNumber: '',
  dietaryRestrictions: '',
  allergies: '',
  notes: '',
  billingEmail: '',
  billingName: '',
  billingPhone: '',
  createLogin: true,
  email: '',
  password: ''
};

function SaveCardForm({ billingInfo, onSuccess, onError, disabled }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || disabled) return;

    setIsProcessing(true);
    onError(null);

    try {
      const cardEl = elements.getElement(CardElement);
      const pmResult = await createPaymentMethod(cardEl, {
        name: billingInfo?.billingName || undefined,
        email: billingInfo?.billingEmail || undefined,
        phone: billingInfo?.billingPhone || undefined
      });
      if (!pmResult?.success || !pmResult?.paymentMethod) {
        onError(pmResult?.error || 'Could not create payment method');
        return;
      }
      await onSuccess(pmResult.paymentMethod.id);
    } catch (err) {
      onError(err.message || 'Could not create payment method');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="residents-tab__save-card-form">
      <div className="residents-tab__card-element">
        <label>Card</label>
        <CardElement options={cardElementOptions} />
      </div>
      <button
        type="submit"
        className="btn-primary btn-sm"
        disabled={!stripe || isProcessing || disabled}
      >
        {isProcessing ? 'Saving…' : 'Save card on file'}
      </button>
    </form>
  );
}

SaveCardForm.propTypes = {
  billingInfo: PropTypes.object,
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

const ResidentsTab = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [facilities, setFacilities] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facilityFilter, setFacilityFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [staffOptions, setStaffOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [actionConfirm, setActionConfirm] = useState(null); // { resident, mode: 'deactivate' | 'delete' }
  const [submitting, setSubmitting] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [cardSuccess, setCardSuccess] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

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
      const params = { page, limit, isActive: 'true' };
      if (isAdmin && facilityFilter) params.facilityId = facilityFilter;
      if (search.trim()) params.search = search.trim();
      if (staffFilter) params.assignedUserId = staffFilter;
      const res = await fetchResidents(params);
      setResidents(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load residents');
      setResidents([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, facilityFilter, search, staffFilter, page, limit]);

  const loadStaffOptions = useCallback(async () => {
    const facilityIds = isAdmin
      ? (facilityFilter ? [facilityFilter] : facilities.map((f) => f.id))
      : (user?.nursingHomeFacilityId ? [user.nursingHomeFacilityId] : []);
    if (!facilityIds.length) {
      setStaffOptions([]);
      return;
    }
    try {
      const lists = await Promise.all(
        facilityIds.map(async (id) => {
          const list = await fetchStaffForFacility(id);
          const facilityName = facilities.find((f) => f.id === id)?.name;
          return (Array.isArray(list) ? list : []).map((s) => ({
            ...s,
            facilityName
          }));
        })
      );
      const byId = new Map();
      lists.flat().forEach((s) => {
        if (s?.id && !byId.has(s.id)) byId.set(s.id, s);
      });
      setStaffOptions([...byId.values()].sort((a, b) => {
        const an = formatAssignedStaffName(a) || '';
        const bn = formatAssignedStaffName(b) || '';
        return an.localeCompare(bn);
      }));
    } catch {
      setStaffOptions([]);
    }
  }, [isAdmin, facilityFilter, facilities, user?.nursingHomeFacilityId]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    loadStaffOptions();
  }, [loadStaffOptions]);

  useEffect(() => {
    if (staffFilter && staffFilter !== 'unassigned' && staffOptions.length > 0
      && !staffOptions.some((s) => s.id === staffFilter)) {
      setStaffFilter('');
    }
  }, [staffFilter, staffOptions]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);

  const handleOpenAdd = () => {
    setEditingResident(null);
    setForm({
      ...emptyForm,
      facilityId: isAdmin ? (facilityFilter || (facilities[0]?.id || '')) : user?.nursingHomeFacilityId || ''
    });
    setCardError(null);
    setCardSuccess(null);
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
      notes: r.notes || '',
      billingEmail: r.billingEmail || '',
      billingName: r.billingName || '',
      billingPhone: r.billingPhone || '',
      createLogin: !r.userId && !r.userAccount,
      email: r.userAccount?.email || '',
      password: ''
    });
    setCardError(null);
    setCardSuccess(null);
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
    const hasExistingLogin = Boolean(editingResident?.userId || editingResident?.userAccount);
    const wantsLogin = form.createLogin && !hasExistingLogin;
    if (wantsLogin) {
      if (!form.email.trim()) {
        setError('Login email is required when creating a resident login');
        return;
      }
      if (!form.password || form.password.length < 8) {
        setError('Login password must be at least 8 characters');
        return;
      }
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
        notes: form.notes.trim() || undefined,
        billingEmail: form.billingEmail.trim() || null,
        billingName: form.billingName.trim() || null,
        billingPhone: form.billingPhone.trim() || null
      };
      if (wantsLogin) {
        payload.createLogin = true;
        payload.email = form.email.trim();
        payload.password = form.password;
      } else if (hasExistingLogin && form.password && form.password.length >= 8) {
        payload.password = form.password;
      }
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

  const handleSaveCard = async (paymentMethodId) => {
    if (!editingResident?.id) return;
    setCardSaving(true);
    setCardError(null);
    setCardSuccess(null);
    try {
      const updated = await saveResidentPaymentMethod(editingResident.id, {
        paymentMethodId,
        billingEmail: form.billingEmail.trim() || undefined,
        billingName: form.billingName.trim() || undefined,
        billingPhone: form.billingPhone.trim() || undefined
      });
      const next = updated || { ...editingResident, paymentMethodId };
      setEditingResident(next);
      setCardSuccess('Card saved on file');
      loadResidents();
    } catch (err) {
      setCardError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save card');
    } finally {
      setCardSaving(false);
    }
  };

  const handleDeactivateClick = (r) => setActionConfirm({ resident: r, mode: 'deactivate' });
  const handleDeleteClick = (r) => setActionConfirm({ resident: r, mode: 'delete' });
  const handleActionConfirm = async () => {
    if (!actionConfirm?.resident) return;
    const { resident, mode } = actionConfirm;
    try {
      setSubmitting(true);
      setError(null);
      if (mode === 'delete') {
        await permanentlyDeleteResident(resident.id);
      } else {
        await deactivateResident(resident.id);
      }
      setActionConfirm(null);
      loadResidents();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          (mode === 'delete' ? 'Failed to delete resident' : 'Failed to deactivate resident')
      );
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
      <p className="tab-hint" style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>
        Residents are meal recipients. Optionally create a login so they can place their own weekly orders.
        Staff (nursing home admins) are managed separately and cannot be created here.
      </p>

      <div className="filters-row">
        {isAdmin && facilities.length > 0 && (
          <label>
            <span>Facility</span>
            <select
              value={facilityFilter}
              onChange={(e) => {
                setFacilityFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Assigned staff</span>
          <select
            value={staffFilter}
            onChange={(e) => {
              setStaffFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {staffOptions.map((s) => {
              const name = formatAssignedStaffName(s) || s.email || s.id;
              const showFacility = isAdmin && !facilityFilter && s.facilityName;
              return (
                <option key={s.id} value={s.id}>
                  {showFacility ? `${name} (${s.facilityName})` : name}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          <span>Search</span>
          <input
            type="text"
            placeholder="Search by name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {error && !modalOpen && !actionConfirm && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : residents.length === 0 ? (
        <div className="content-placeholder">
          <p>
            {staffFilter || search || facilityFilter
              ? 'No residents match these filters.'
              : 'No residents found.'}
          </p>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            Add Resident
          </button>
        </div>
      ) : (
        <div className="nh-mgmt-table-container">
          <div className="nh-mgmt-table-scroll">
            <table className="nh-mgmt-table residents-tab__table" role="grid">
              <colgroup>
                {isAdmin && <col className="col-facility" />}
                <col className="col-name" />
                <col className="col-room" />
                <col className="col-assigned" />
                <col className="col-login" />
                <col className="col-dietary" />
                <col className="col-card" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  {isAdmin && <th>Facility</th>}
                  <th>Name</th>
                  <th>Room</th>
                  <th>Assigned staff</th>
                  <th>Login</th>
                  <th>Dietary / Allergies</th>
                  <th>Card</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => (
                <tr key={r.id}>
                  {isAdmin && <td>{r.facility ? r.facility.name : facilityName(r.facilityId)}</td>}
                  <td className="nh-mgmt-table__name">{r.name}</td>
                  <td>{r.roomNumber || '-'}</td>
                  <td>
                    {formatAssignedStaffName(r.assignedUser) ? (
                      <span
                        className="assignment-pill assignment-pill--assigned"
                        title={r.assignedUser?.email || undefined}
                      >
                        {formatAssignedStaffName(r.assignedUser)}
                      </span>
                    ) : (
                      <span className="assignment-pill assignment-pill--unassigned">Unassigned</span>
                    )}
                  </td>
                  <td>
                    {r.userAccount?.email || r.userId
                      ? (r.userAccount?.email || 'Linked')
                      : 'No login'}
                  </td>
                  <td>
                    {[r.dietaryRestrictions, r.allergies].filter(Boolean).join(' · ') || '-'}
                  </td>
                  <td>{r.paymentMethodId ? 'On file' : '-'}</td>
                  <td className="nh-mgmt-table__actions">
                    <div className="user-actions">
                      <button type="button" className="edit-btn" onClick={() => handleOpenEdit(r)}>
                        Edit
                      </button>
                      <button type="button" className="deactivate-btn" onClick={() => handleDeactivateClick(r)}>
                        Deactivate
                      </button>
                      <button type="button" className="delete-btn" onClick={() => handleDeleteClick(r)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          <div className="nh-mgmt-table-pagination pagination-footer">
            <Pagination
              page={page}
              totalPages={Math.max(1, pagination.totalPages)}
              rowsPerPage={limit}
              total={pagination.total}
              onPageChange={setPage}
              onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </div>
        </div>
      )}

      {actionConfirm && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && setActionConfirm(null)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>{actionConfirm.mode === 'delete' ? 'Confirm Delete' : 'Confirm Deactivate'}</h2>
              <button
                type="button"
                className="admin-nursing-homes__modal-close"
                onClick={() => setActionConfirm(null)}
                disabled={submitting}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-nursing-homes__modal-content">
              {actionConfirm.mode === 'delete' ? (
                <p style={{ margin: '0 0 20px 0', color: 'rgba(6, 23, 87, 0.7)', lineHeight: 1.6 }}>
                  Permanently delete &quot;{actionConfirm.resident.name}&quot;? This cannot be undone and will remove their orders from this facility.
                </p>
              ) : (
                <p style={{ margin: '0 0 20px 0', color: 'rgba(6, 23, 87, 0.7)', lineHeight: 1.6 }}>
                  Deactivate &quot;{actionConfirm.resident.name}&quot;? They will no longer appear in active lists.
                </p>
              )}
              <div className="admin-nursing-homes__form-actions">
                <button type="button" onClick={() => setActionConfirm(null)} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={actionConfirm.mode === 'delete' ? 'admin-nursing-homes__delete-confirm-btn' : 'btn-danger'}
                  onClick={handleActionConfirm}
                  disabled={submitting}
                >
                  {submitting
                    ? actionConfirm.mode === 'delete'
                      ? 'Deleting…'
                      : 'Deactivating…'
                    : actionConfirm.mode === 'delete'
                      ? 'Delete Resident'
                      : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="admin-nursing-homes__overlay" onClick={() => !submitting && !cardSaving && setModalOpen(false)}>
          <div className="admin-nursing-homes__modal admin-nursing-homes__modal--form" onClick={(e) => e.stopPropagation()}>
            <div className="admin-nursing-homes__modal-header">
              <h2>{editingResident ? 'Edit Resident' : 'Add Resident'}</h2>
              <button
                type="button"
                className="admin-nursing-homes__modal-close"
                onClick={() => !submitting && !cardSaving && setModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
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
                  <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                    <label>Billing Email</label>
                    <input
                      type="email"
                      value={form.billingEmail}
                      onChange={(e) => setForm(prev => ({ ...prev, billingEmail: e.target.value }))}
                      placeholder="billing@example.com"
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>Billing Name</label>
                    <input
                      type="text"
                      value={form.billingName}
                      onChange={(e) => setForm(prev => ({ ...prev, billingName: e.target.value }))}
                      placeholder="Person responsible for payment"
                    />
                  </div>
                  <div className="admin-nursing-homes__form-group">
                    <label>Billing Phone</label>
                    <input
                      type="tel"
                      value={form.billingPhone}
                      onChange={(e) => setForm(prev => ({ ...prev, billingPhone: e.target.value }))}
                      placeholder="555-123-4567"
                    />
                  </div>

                  {(editingResident?.userAccount || editingResident?.userId) ? (
                    <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                      <label>Resident login</label>
                      <p className="tab-hint" style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.9rem' }}>
                        Login linked: {editingResident.userAccount?.email || 'Active account'}
                      </p>
                      <label>Reset password (optional)</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="Leave blank to keep current password"
                        minLength={8}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                        <label className="residents-tab__login-toggle">
                          <input
                            type="checkbox"
                            checked={form.createLogin}
                            onChange={(e) => setForm((prev) => ({ ...prev, createLogin: e.target.checked }))}
                          />
                          <span>Create portal login for this resident</span>
                        </label>
                        <p className="tab-hint" style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                          Lets them place their own weekly meal orders. Staff can still order for them.
                        </p>
                      </div>
                      {form.createLogin && (
                        <>
                          <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                            <label>Login email *</label>
                            <input
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                              placeholder="resident@example.com"
                              required={form.createLogin}
                            />
                          </div>
                          <div className="admin-nursing-homes__form-group admin-nursing-homes__form-group--full">
                            <label>Login password *</label>
                            <input
                              type="password"
                              value={form.password}
                              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                              placeholder="Min 8 characters"
                              minLength={8}
                              required={form.createLogin}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="admin-nursing-homes__form-actions">
                  <button type="button" onClick={() => !submitting && !cardSaving && setModalOpen(false)} disabled={submitting || cardSaving}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting || cardSaving}>
                    {submitting ? 'Saving…' : (editingResident ? 'Save' : 'Create Resident')}
                  </button>
                </div>
              </form>

              {editingResident && (
                <section className="residents-tab__save-card">
                  <h3>Save card on file</h3>
                  <p className="residents-tab__card-status">
                    {editingResident.paymentMethodId
                      ? `Card on file (${editingResident.paymentMethodId.slice(0, 14)}…)`
                      : 'No payment method on file'}
                  </p>
                  {cardError && (
                    <ErrorMessage message={cardError} type="error" onDismiss={() => setCardError(null)} />
                  )}
                  {cardSuccess && (
                    <ErrorMessage message={cardSuccess} type="success" onDismiss={() => setCardSuccess(null)} />
                  )}
                  <Elements stripe={stripePromise}>
                    <SaveCardForm
                      billingInfo={form}
                      onSuccess={handleSaveCard}
                      onError={setCardError}
                      disabled={cardSaving || submitting}
                    />
                  </Elements>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentsTab;

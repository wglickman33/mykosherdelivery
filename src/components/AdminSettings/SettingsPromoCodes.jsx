import './AdminSettings.scss';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import {
  fetchPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode
} from '../../services/promoCodeService';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SettingsPromoCodes = () => {
  const { user } = useAuth();
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoFilters, setPromoFilters] = useState({
    search: '',
    active: '',
    page: 1,
    limit: 20
  });
  const [promoTotalCount, setPromoTotalCount] = useState(0);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [promoFormErrors, setPromoFormErrors] = useState({});
  const [promoSaving, setPromoSaving] = useState(false);
  const [deletingPromoId, setDeletingPromoId] = useState(null);
  const [promoFormData, setPromoFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    active: true,
    expiresAt: '',
    usageLimit: '',
    stackable: false,
    allowedDays: []
  });

  useEffect(() => {
    fetchPromoData();
  }, [promoFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPromoData = async () => {
    setPromoLoading(true);
    setPromoError('');

    if (!user) {
      setPromoError('Please log in to access promo code management.');
      setPromoLoading(false);
      return;
    }

    if (user.role !== 'admin') {
      setPromoError(`Admin access required. Current role: ${user.role || 'none'}. You do not have permission to manage promo codes.`);
      setPromoLoading(false);
      return;
    }

    try {
      const result = await fetchPromoCodes(
        promoFilters.page,
        promoFilters.limit,
        promoFilters.search,
        promoFilters.active
      );
      if (result.success) {
        setPromoCodes(result.data.promoCodes);
        setPromoTotalCount(result.data.totalCount);
      }
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      setPromoError(error.message || 'Failed to load promo codes');
    }
    setPromoLoading(false);
  };

  const handlePromoSubmit = async (e) => {
    e.preventDefault();

    const errors = validatePromoForm();
    setPromoFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setPromoSaving(true);
    setPromoError('');

    try {
      const discountVal = parseFloat(promoFormData.discountValue);
      const formData = {
        code: promoFormData.code.trim(),
        discountType: promoFormData.discountType,
        discountValue: discountVal,
        active: Boolean(promoFormData.active),
        stackable: Boolean(promoFormData.stackable),
        allowedDays: (promoFormData.allowedDays && promoFormData.allowedDays.length > 0) ? promoFormData.allowedDays : []
      };
      if (promoFormData.usageLimit && String(promoFormData.usageLimit).trim()) {
        formData.usageLimit = parseInt(promoFormData.usageLimit, 10);
      }
      if (promoFormData.expiresAt && String(promoFormData.expiresAt).trim()) {
        formData.expiresAt = promoFormData.expiresAt.trim();
      }

      if (editingPromo) {
        await updatePromoCode(editingPromo.id, formData);
      } else {
        await createPromoCode(formData);
      }

      setShowPromoModal(false);
      setEditingPromo(null);
      resetPromoForm();
      fetchPromoData();
    } catch (error) {
      console.error('Error saving promo code:', error);
      setPromoError(error.message || 'Failed to save promo code');
    }
    setPromoSaving(false);
  };

  const handlePromoEdit = (promo) => {
    setEditingPromo(promo);
    const allowed = getAllowedDaysFromPromo(promo);
    setPromoFormData({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: (promo.discountValue ?? promo.discount_value ?? '').toString(),
      active: promo.active,
      expiresAt: promo.expiresAt ? (typeof promo.expiresAt === 'string' ? promo.expiresAt : promo.expires_at || '').split('T')[0] : '',
      usageLimit: promo.usageLimit != null ? promo.usageLimit.toString() : (promo.usage_limit != null ? String(promo.usage_limit) : ''),
      stackable: promo.stackable ?? false,
      allowedDays: Array.isArray(allowed) ? [...allowed] : (allowed != null && allowed.length ? allowed : [])
    });
    setPromoFormErrors({});
    setPromoError('');
    setShowPromoModal(true);
  };

  const handlePromoDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete the promo code "${code}"? This action cannot be undone.`)) {
      return;
    }

    setPromoError('');
    setDeletingPromoId(id);

    try {
      await deletePromoCode(id);
      fetchPromoData();
    } catch (error) {
      console.error('Error deleting promo code:', error);
      setPromoError(error.message || 'Failed to delete promo code');
    } finally {
      setDeletingPromoId(null);
    }
  };

  const resetPromoForm = () => {
    setPromoFormData({
      code: '',
      discountType: 'percentage',
      discountValue: '',
      active: true,
      expiresAt: '',
      usageLimit: '',
      stackable: false,
      allowedDays: []
    });
    setPromoFormErrors({});
  };

  const togglePromoAllowedDay = (dayNum) => {
    const current = promoFormData.allowedDays || [];
    if (current.includes(dayNum)) {
      setPromoFormData({ ...promoFormData, allowedDays: current.filter(d => d !== dayNum) });
    } else {
      setPromoFormData({ ...promoFormData, allowedDays: [...current, dayNum].sort((a, b) => a - b) });
    }
  };

  const getAllowedDaysFromPromo = (promo) => {
    const raw = promo.allowedDays ?? promo.allowed_days;
    if (raw == null || raw === '') return null;
    if (Array.isArray(raw)) return raw.length ? raw : null;
    return String(raw).split(',').map(Number).filter(n => !Number.isNaN(n) && n >= 0 && n <= 6);
  };

  const formatAllowedDays = (promo) => {
    const arr = getAllowedDaysFromPromo(promo);
    if (!arr || arr.length === 0) return 'Every day';
    return arr.map(d => DAY_NAMES[d].slice(0, 3)).join(', ');
  };

  const validatePromoForm = () => {
    const errors = {};

    if (!promoFormData.code.trim()) {
      errors.code = 'Promo code is required';
    } else if (promoFormData.code.length < 3) {
      errors.code = 'Promo code must be at least 3 characters';
    } else if (!/^[A-Za-z0-9]+$/.test(promoFormData.code)) {
      errors.code = 'Promo code can only contain letters and numbers';
    }

    if (!promoFormData.discountValue) {
      errors.discountValue = 'Discount value is required';
    } else {
      const value = parseFloat(promoFormData.discountValue);
      if (isNaN(value) || value <= 0) {
        errors.discountValue = 'Discount value must be a positive number';
      } else if (promoFormData.discountType === 'percentage' && value > 100) {
        errors.discountValue = 'Percentage discount cannot exceed 100%';
      }
    }

    if (promoFormData.usageLimit && promoFormData.usageLimit.trim()) {
      const limit = parseInt(promoFormData.usageLimit);
      if (isNaN(limit) || limit < 1) {
        errors.usageLimit = 'Usage limit must be a positive integer';
      }
    }

    if (promoFormData.expiresAt) {
      const expirationDate = new Date(promoFormData.expiresAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expirationDate < today) {
        errors.expiresAt = 'Expiration date cannot be in the past';
      }
    }

    return errors;
  };

  return (
    <div className="promo-codes-tab">
      <div className="promo-codes-header">
        <h3>Promo Code Management</h3>
        <button
          className="add-promo-btn"
          onClick={() => {
            resetPromoForm();
            setEditingPromo(null);
            setPromoError('');
            setShowPromoModal(true);
          }}
        >
          Add New Promo Code
        </button>
      </div>

      {promoError && (
        <div className="error-message">
          <p>{promoError}</p>
        </div>
      )}

      <div className="promo-filters">
        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Search by code..."
            value={promoFilters.search}
            onChange={(e) => setPromoFilters({ ...promoFilters, search: e.target.value, page: 1 })}
          />
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select
            value={promoFilters.active}
            onChange={(e) => setPromoFilters({ ...promoFilters, active: e.target.value, page: 1 })}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {promoLoading ? (
        <LoadingSpinner size="medium" />
      ) : (
        <>
          <div className="promo-codes-table">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Valid days</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Stackable</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map(promo => (
                  <tr key={promo.id}>
                    <td className="code-cell">{promo.code}</td>
                    <td>{promo.discountType}</td>
                    <td>
                      {promo.discountType === 'percentage'
                        ? `${promo.discountValue}%`
                        : `${promo.discountValue}`}
                    </td>
                    <td>{formatAllowedDays(promo)}</td>
                    <td>
                      {promo.usageLimit
                        ? `${promo.usageCount}/${promo.usageLimit}`
                        : `${promo.usageCount}/∞`}
                    </td>
                    <td>
                      <span className={`status-badge ${promo.active ? 'active' : 'inactive'}`}>
                        {promo.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {promo.expiresAt
                        ? new Date(promo.expiresAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td>
                      <span className={`stackable-badge ${promo.stackable ? 'yes' : 'no'}`}>
                        {promo.stackable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="edit-btn"
                        onClick={() => handlePromoEdit(promo)}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handlePromoDelete(promo.id, promo.code)}
                        disabled={deletingPromoId === promo.id}
                      >
                        {deletingPromoId === promo.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {promoTotalCount === 0 && !promoLoading && (
            <div className="empty-state">
              <p>No promo codes found. Create your first promo code to get started!</p>
            </div>
          )}

          {promoCodes.length === 0 && promoTotalCount > 0 && (
            <div className="empty-state">
              <p>No promo codes match your current filters.</p>
            </div>
          )}

          {promoTotalCount > promoFilters.limit && (
            <div className="pagination-info">
              <p>
                Showing {promoCodes.length} of {promoTotalCount} promo codes
                {promoTotalCount > promoFilters.limit && ' (pagination coming soon)'}
              </p>
            </div>
          )}
        </>
      )}

      {showPromoModal && (
        <div className="modal-overlay" onClick={() => setShowPromoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{editingPromo ? 'Edit Promo Code' : 'Add New Promo Code'}</h4>
              <button
                className="close-btn"
                onClick={() => setShowPromoModal(false)}
              >
                ×
              </button>
            </div>

            {promoError && (
              <div className="error-message">
                <p>{promoError}</p>
              </div>
            )}

            <form onSubmit={handlePromoSubmit} className="promo-form">
              <div className="form-row form-row--two">
                <div className="form-group">
                  <label htmlFor="code">Promo Code *</label>
                  <input
                    type="text"
                    id="code"
                    value={promoFormData.code}
                    onChange={(e) => setPromoFormData({ ...promoFormData, code: e.target.value })}
                    placeholder="e.g., WELCOME2MKD"
                    required
                    maxLength={50}
                    className={promoFormErrors.code ? 'error' : ''}
                  />
                  {promoFormErrors.code && (
                    <span className="field-error">{promoFormErrors.code}</span>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="discountType">Discount Type *</label>
                  <select
                    id="discountType"
                    value={promoFormData.discountType}
                    onChange={(e) => setPromoFormData({ ...promoFormData, discountType: e.target.value })}
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>

              <div className="form-row form-row--two">
                <div className="form-group">
                  <label htmlFor="discountValue">
                    Discount Value * {promoFormData.discountType === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    id="discountValue"
                    value={promoFormData.discountValue}
                    onChange={(e) => setPromoFormData({ ...promoFormData, discountValue: e.target.value })}
                    placeholder={promoFormData.discountType === 'percentage' ? '10' : '5.00'}
                    min="0"
                    max={promoFormData.discountType === 'percentage' ? '100' : undefined}
                    step={promoFormData.discountType === 'percentage' ? '1' : '0.01'}
                    required
                    className={promoFormErrors.discountValue ? 'error' : ''}
                  />
                  {promoFormErrors.discountValue && (
                    <span className="field-error">{promoFormErrors.discountValue}</span>
                  )}
                </div>
                <div className="form-group form-group--equal">
                  <label htmlFor="usageLimit">Usage Limit</label>
                  <input
                    type="number"
                    id="usageLimit"
                    value={promoFormData.usageLimit}
                    onChange={(e) => setPromoFormData({ ...promoFormData, usageLimit: e.target.value })}
                    placeholder="Leave empty for unlimited"
                    min="1"
                    className={promoFormErrors.usageLimit ? 'error' : ''}
                  />
                  {promoFormErrors.usageLimit && (
                    <span className="field-error">{promoFormErrors.usageLimit}</span>
                  )}
                </div>
              </div>

              <div className="form-row form-row--two">
                <div className="form-group">
                  <label htmlFor="expiresAt">Expiration Date</label>
                  <input
                    type="date"
                    id="expiresAt"
                    value={promoFormData.expiresAt}
                    onChange={(e) => setPromoFormData({ ...promoFormData, expiresAt: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className={promoFormErrors.expiresAt ? 'error' : ''}
                  />
                  {promoFormErrors.expiresAt && (
                    <span className="field-error">{promoFormErrors.expiresAt}</span>
                  )}
                </div>
                <div className="form-group form-group--spacer" aria-hidden="true" />
              </div>

              <div className="form-row form-row--days">
                <div className="form-group form-group--full">
                  <label>Valid days of week</label>
                  <p className="field-hint">Tap days when this code works. Leave all unselected for every day.</p>
                  <div className="day-pills">
                    {DAY_NAMES.map((name, idx) => {
                      const isSelected = (promoFormData.allowedDays || []).includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`day-pill ${isSelected ? 'day-pill--selected' : ''}`}
                          onClick={() => togglePromoAllowedDay(idx)}
                          title={name}
                          aria-pressed={isSelected}
                        >
                          {name.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="form-row form-row--toggles">
                <label className="promo-toggle">
                  <input
                    type="checkbox"
                    checked={promoFormData.active}
                    onChange={(e) => setPromoFormData({ ...promoFormData, active: e.target.checked })}
                    aria-label="Promo code is active"
                  />
                  <span className="toggle-track" aria-hidden="true" />
                  <span className="toggle-label">Active</span>
                </label>
                <label className="promo-toggle">
                  <input
                    type="checkbox"
                    checked={promoFormData.stackable}
                    onChange={(e) => setPromoFormData({ ...promoFormData, stackable: e.target.checked })}
                    aria-label="Stackable with other promos"
                  />
                  <span className="toggle-track" aria-hidden="true" />
                  <span className="toggle-label" title="Stackable with other promos">Stackable</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowPromoModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-btn"
                  disabled={promoSaving}
                  onClick={(e) => {
                    e.preventDefault();
                    handlePromoSubmit(e);
                  }}
                >
                  {promoSaving ? 'Saving...' : (editingPromo ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPromoCodes;

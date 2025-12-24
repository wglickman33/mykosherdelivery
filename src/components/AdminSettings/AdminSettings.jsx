import './AdminSettings.scss';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { fetchAuditLogs } from '../../services/adminServices';
import { 
  getCountdownSettings, 
  updateCountdownSettings, 
  resetCountdownSettings,
  getDayName,
  formatTimeForDisplay,
  parseDisplayTime
} from '../../services/countdownService';
import {
  fetchPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode
} from '../../services/promoCodeService';

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('countdown-timer');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: 'all',
    table: 'all',
    search: '',
    page: 1,
    limit: 20
  });
  const [totalCount, setTotalCount] = useState(0);
  
  // Countdown timer settings state
  const [countdownSettings, setCountdownSettings] = useState({
    targetDay: 4,
    targetTime: '18:00',
    resetDay: 6,
    resetTime: '00:00',
    timezone: 'America/New_York',
    targetDayName: 'Thursday',
    resetDayName: 'Saturday',
  });
  const [countdownLoading, setCountdownLoading] = useState(false);
  const [countdownMessage, setCountdownMessage] = useState('');
  
  // Promo codes state
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
    stackable: false
  });
  
  const { user } = useAuth();

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchAuditData();
    } else if (activeTab === 'countdown-timer') {
      fetchCountdownSettings();
    } else if (activeTab === 'promo-codes') {
      fetchPromoData();
    }
  }, [activeTab, filters, promoFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAuditData = async () => {
    setLoading(true);
    const result = await fetchAuditLogs(filters);
    if (result.success) {
      setAuditLogs(result.data);
      setTotalCount(result.pagination?.total || 0);
    }
    setLoading(false);
  };

  const fetchCountdownSettings = async () => {
    setCountdownLoading(true);
    try {
      const settings = await getCountdownSettings();
      setCountdownSettings(settings);
      setCountdownMessage('');
    } catch {
      setCountdownMessage('Error loading countdown settings');
    }
    setCountdownLoading(false);
  };

  const handleCountdownUpdate = async () => {
    setCountdownLoading(true);
    setCountdownMessage('');
    
    try {
      const result = await updateCountdownSettings({
        targetDay: countdownSettings.targetDay,
        targetTime: countdownSettings.targetTime,
        resetDay: countdownSettings.resetDay,
        resetTime: countdownSettings.resetTime,
        timezone: countdownSettings.timezone,
      });

      if (result.success) {
        setCountdownSettings(result.data.settings);
        setCountdownMessage('Settings updated successfully!');
        setTimeout(() => setCountdownMessage(''), 3000);
      } else {
        setCountdownMessage(`Error: ${result.error}`);
      }
    } catch {
      setCountdownMessage('Error updating settings');
    }
    
    setCountdownLoading(false);
  };

  const handleCountdownReset = async () => {
    setCountdownLoading(true);
    setCountdownMessage('');
    
    try {
      const result = await resetCountdownSettings();
      
      if (result.success) {
        // Fetch updated settings after reset
        await fetchCountdownSettings();
        setCountdownMessage('Settings reset to defaults successfully!');
        setTimeout(() => setCountdownMessage(''), 3000);
      } else {
        setCountdownMessage(`Error: ${result.error}`);
      }
    } catch {
      setCountdownMessage('Error resetting settings');
    }
    
    setCountdownLoading(false);
  };

  const handleCountdownSettingChange = (field, value) => {
    if (field === 'targetDay' || field === 'resetDay') {
      const dayName = getDayName(parseInt(value));
      setCountdownSettings(prev => ({
        ...prev,
        [field]: parseInt(value),
        [`${field.replace('Day', 'DayName')}`]: dayName
      }));
    } else if (field === 'targetTime' || field === 'resetTime') {
      const time24 = parseDisplayTime(value);
      setCountdownSettings(prev => ({
        ...prev,
        [field]: time24
      }));
    } else {
      setCountdownSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const formatTimestamp = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return '#10b981';
      case 'UPDATE': return '#f59e0b';
      case 'DELETE': return '#ef4444';
      case 'LOGIN': return '#3b82f6';
      case 'LOGOUT': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'CREATE': return 'Add';
      case 'UPDATE': return 'Edit';
      case 'DELETE': return 'Delete';
      case 'LOGIN': return 'Login';
      case 'LOGOUT': return 'Logout';
      default: return action;
    }
  };

  // Promo code functions
  const fetchPromoData = async () => {
    setPromoLoading(true);
    setPromoError('');
    
    // Check if user is logged in and is an admin
    console.log('Current user:', user);
    
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
    
    // Validate form
    const errors = validatePromoForm();
    setPromoFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    setPromoSaving(true);
    setPromoError('');
    
    try {
      const formData = {
        ...promoFormData,
        discountValue: parseFloat(promoFormData.discountValue),
        // Only include usageLimit if it has a value (don't send null)
        ...(promoFormData.usageLimit && promoFormData.usageLimit.trim() ? { usageLimit: parseInt(promoFormData.usageLimit) } : {}),
        // Only include expiresAt if it has a value (don't send null or empty string)
        ...(promoFormData.expiresAt && promoFormData.expiresAt.trim() ? { expiresAt: promoFormData.expiresAt } : {})
      };

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
    setPromoFormData({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue.toString(),
      active: promo.active,
      expiresAt: promo.expiresAt ? promo.expiresAt.split('T')[0] : '',
      usageLimit: promo.usageLimit ? promo.usageLimit.toString() : '',
      stackable: promo.stackable || false
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
      stackable: false
    });
    setPromoFormErrors({});
  };

  const validatePromoForm = () => {
    const errors = {};

    // Code validation
    if (!promoFormData.code.trim()) {
      errors.code = 'Promo code is required';
    } else if (promoFormData.code.length < 3) {
      errors.code = 'Promo code must be at least 3 characters';
    } else if (!/^[A-Za-z0-9]+$/.test(promoFormData.code)) {
      errors.code = 'Promo code can only contain letters and numbers';
    }

    // Discount value validation
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

    // Usage limit validation
    if (promoFormData.usageLimit && promoFormData.usageLimit.trim()) {
      const limit = parseInt(promoFormData.usageLimit);
      if (isNaN(limit) || limit < 1) {
        errors.usageLimit = 'Usage limit must be a positive integer';
      }
    }

    // Expiration date validation
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

  const formatAuditLogData = (log) => {
    if (!log.oldValues && !log.newValues) return 'No changes recorded';
    
    const changes = [];
    if (log.oldValues && log.newValues) {
      // Update operation - show what changed
      Object.keys(log.newValues).forEach(key => {
        if (log.oldValues[key] !== log.newValues[key]) {
          changes.push(`${key}: "${log.oldValues[key]}" → "${log.newValues[key]}"`);
        }
      });
    } else if (log.newValues) {
      // Create operation - show new values
      Object.entries(log.newValues).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          changes.push(`${key}: "${value}"`);
        }
      });
    } else if (log.oldValues) {
      // Delete operation - show what was deleted
      Object.entries(log.oldValues).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          changes.push(`${key}: "${value}"`);
        }
      });
    }
    
    return changes.length > 0 ? changes.slice(0, 2).join(', ') + (changes.length > 2 ? '...' : '') : 'No data';
  };

  const tabs = [
    { id: 'countdown-timer', label: 'Countdown Timer' },
    { id: 'promo-codes', label: 'Promo Codes' },
    { id: 'logs', label: 'Logs' }
  ];

  const totalPages = Math.ceil((totalCount || 0) / filters.limit) || 1;

  return (
    <div className="admin-settings">
      <div className="settings-header">
        <div className="header-content">
          <h1>Settings & Administration</h1>
          <p>Manage system settings, audit logs, and administrative functions</p>
        </div>
      </div>

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'logs' && (
          <div className="audit-logs-tab">
            <div className="audit-filters">
              <div className="filter-group">
                <label>Action Type</label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
                >
                  <option value="all">All Actions</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Table</label>
                <select
                  value={filters.table}
                  onChange={(e) => setFilters({ ...filters, table: e.target.value, page: 1 })}
                >
                  <option value="all">All Tables</option>
                  <option value="orders">Orders</option>
                  <option value="profiles">Users</option>
                  <option value="restaurants">Restaurants</option>
                  <option value="support_tickets">Support Tickets</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Search Admin</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  placeholder="Search by admin..."
                />
              </div>
            </div>

            {loading ? (
              <div className="audit-loading">
                <LoadingSpinner size="large" />
                <p>Loading audit logs...</p>
              </div>
            ) : (
              <>
                <div className="audit-table-container">
                  <div className="audit-table-scroll">
                    <table className="audit-table">
                      <colgroup>
                        <col className="col-timestamp" />
                        <col className="col-admin" />
                        <col className="col-action" />
                        <col className="col-table" />
                        <col className="col-record" />
                        <col className="col-changes" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Admin</th>
                          <th>Action</th>
                          <th>Table</th>
                          <th>Record ID</th>
                          <th>Changes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map(log => (
                          <tr key={log.id}>
                            <td>{formatTimestamp(log.createdAt)}</td>
                            <td>
                              <div className="admin-info">
                                <span className="name">{log.admin?.name || 'Unknown'}</span>
                                <span className="email">{log.admin?.email || 'N/A'}</span>
                              </div>
                            </td>
                            <td>
                              <span 
                                className="action-badge"
                                style={{ backgroundColor: getActionColor(log.action) }}
                              >
                                {getActionLabel(log.action)}
                              </span>
                            </td>
                            <td>{log.tableName}</td>
                            <td className="record-id">{log.recordId}</td>
                            <td className="changes-cell">
                              <div className="changes-summary">
                                {formatAuditLogData(log)}
                              </div>
                              {(log.oldValues || log.newValues) && (
                                <details className="changes-details">
                                  <summary>Details</summary>
                                  <div className="changes-content">
                                    {log.oldValues && (
                                      <div className="old-values">
                                        <strong>Before:</strong>
                                        <pre>{JSON.stringify(log.oldValues, null, 2)}</pre>
                                      </div>
                                    )}
                                    {log.newValues && (
                                      <div className="new-values">
                                        <strong>After:</strong>
                                        <pre>{JSON.stringify(log.newValues, null, 2)}</pre>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pagination">
                  <div className="pagination-info">
                    Showing {((filters.page - 1) * filters.limit) + 1}-{Math.min(filters.page * filters.limit, totalCount || 0)} of {totalCount || 0} logs
                  </div>
                  <div className="pagination-controls">
                    <button 
                      onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                      disabled={filters.page === 1}
                    >
                      Previous
                    </button>
                    <span className="page-info">Page {filters.page} of {totalPages || 1}</span>
                    <button 
                      onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                      disabled={filters.page === (totalPages || 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'promo-codes' && (
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
                              : `$${promo.discountValue}`}
                          </td>
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

            {/* Promo Code Modal */}
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
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="code">Promo Code *</label>
                        <input
                          type="text"
                          id="code"
                          value={promoFormData.code}
                          onChange={(e) => setPromoFormData({ ...promoFormData, code: e.target.value.toUpperCase() })}
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

                    <div className="form-row">
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
                      <div className="form-group">
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

                    <div className="form-row">
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
                    </div>

                    <div className="form-row">
                      <div className="form-group checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={promoFormData.active}
                            onChange={(e) => setPromoFormData({ ...promoFormData, active: e.target.checked })}
                          />
                          Active
                        </label>
                      </div>
                      <div className="form-group checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={promoFormData.stackable}
                            onChange={(e) => setPromoFormData({ ...promoFormData, stackable: e.target.checked })}
                          />
                          Stackable with other promos
                        </label>
                      </div>
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
                        type="submit" 
                        className="save-btn"
                        disabled={promoSaving}
                      >
                        {promoSaving ? 'Saving...' : (editingPromo ? 'Update' : 'Create')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'countdown-timer' && (
          <div className="countdown-timer-tab">
            <div className="countdown-settings-section">
              <h3>Countdown Timer Configuration</h3>
              <p className="section-description">
                Configure when orders close for the week and when they reset. 
                Changes take effect immediately across the platform.
              </p>

              {countdownLoading && (
                <div className="loading-overlay">
                  <LoadingSpinner size="medium" />
                  <p>Loading settings...</p>
                </div>
              )}

              {countdownMessage && (
                <div className={`message ${countdownMessage.includes('successfully') ? 'success' : 'error'}`}>
                  {countdownMessage}
                </div>
              )}

              <div className="countdown-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="targetDay">Order Close Day</label>
                    <select
                      id="targetDay"
                      value={countdownSettings.targetDay}
                      onChange={(e) => handleCountdownSettingChange('targetDay', e.target.value)}
                      disabled={countdownLoading}
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="targetTime">Order Close Time</label>
                    <input
                      id="targetTime"
                      type="time"
                      value={countdownSettings.targetTime}
                      onChange={(e) => handleCountdownSettingChange('targetTime', e.target.value)}
                      disabled={countdownLoading}
                    />
                    <small>Current: {formatTimeForDisplay(countdownSettings.targetTime)} EST</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="resetDay">Order Reset Day</label>
                    <select
                      id="resetDay"
                      value={countdownSettings.resetDay}
                      onChange={(e) => handleCountdownSettingChange('resetDay', e.target.value)}
                      disabled={countdownLoading}
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="resetTime">Order Reset Time</label>
                    <input
                      id="resetTime"
                      type="time"
                      value={countdownSettings.resetTime}
                      onChange={(e) => handleCountdownSettingChange('resetTime', e.target.value)}
                      disabled={countdownLoading}
                    />
                    <small>Current: {formatTimeForDisplay(countdownSettings.resetTime)} EST</small>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="timezone">Timezone</label>
                  <select
                    id="timezone"
                    value={countdownSettings.timezone}
                    onChange={(e) => handleCountdownSettingChange('timezone', e.target.value)}
                    disabled={countdownLoading}
                  >
                    <option value="America/New_York">Eastern Time (EST/EDT)</option>
                    <option value="America/Chicago">Central Time (CST/CDT)</option>
                    <option value="America/Denver">Mountain Time (MST/MDT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                  </select>
                  <small>Automatically handles daylight saving time transitions</small>
                </div>

                <div className="current-settings">
                  <h4>Current Configuration</h4>
                  <div className="settings-summary">
                    <p>
                      <strong>Orders close:</strong> {countdownSettings.targetDayName}s at {formatTimeForDisplay(countdownSettings.targetTime)} EST
                    </p>
                    <p>
                      <strong>Orders reset:</strong> {countdownSettings.resetDayName}s at {formatTimeForDisplay(countdownSettings.resetTime)} EST
                    </p>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handleCountdownUpdate}
                    disabled={countdownLoading}
                    className="btn btn-primary"
                  >
                    {countdownLoading ? 'Updating...' : 'Save Settings'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleCountdownReset}
                    disabled={countdownLoading}
                    className="btn btn-secondary"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;

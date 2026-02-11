import './AdminGiftCards.scss';
import { useState, useEffect } from 'react';
import {
  fetchAdminGiftCards,
  createAdminGiftCard,
  updateAdminGiftCard,
  voidAdminGiftCard
} from '../../services/adminServices';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import NotificationToast from '../NotificationToast/NotificationToast';
import { useNotification } from '../../hooks/useNotification';
import Pagination from '../Pagination/Pagination';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'used', label: 'Used' },
  { value: 'void', label: 'Void' }
];

const AdminGiftCards = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({ status: '', page: 1, limit: 25 });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    initialBalance: '',
    recipientEmail: '',
    purchasedByUserId: ''
  });
  const [saving, setSaving] = useState(false);
  const [voidingId, setVoidingId] = useState(null);
  const { notification, showNotification, hideNotification } = useNotification();

  const load = async () => {
    setLoading(true);
    const params = { page: filters.page, limit: filters.limit };
    if (filters.status) params.status = filters.status;
    const result = await fetchAdminGiftCards(params);
    if (result.success) {
      setList(Array.isArray(result.data) ? result.data : []);
      setPagination(result.pagination || {});
    } else {
      setList([]);
      showNotification(result.error || 'Failed to load gift cards', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filters.page, filters.limit, filters.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e) => {
    e.preventDefault();
    const amount = parseFloat(createForm.initialBalance);
    if (!amount || amount < 0.01) {
      showNotification('Enter a valid amount (min $0.01)', 'error');
      return;
    }
    setSaving(true);
    const result = await createAdminGiftCard({
      initialBalance: amount,
      recipientEmail: createForm.recipientEmail.trim() || undefined,
      purchasedByUserId: createForm.purchasedByUserId.trim() || undefined
    });
    setSaving(false);
    if (result.success) {
      showNotification(`Gift card created: ${result.data?.code} ($${amount.toFixed(2)})`, 'success');
      setShowCreate(false);
      setCreateForm({ initialBalance: '', recipientEmail: '', purchasedByUserId: '' });
      load();
    } else {
      showNotification(result.error || 'Failed to create gift card', 'error');
    }
  };

  const handleVoid = async (id) => {
    setVoidingId(id);
    const result = await voidAdminGiftCard(id);
    setVoidingId(null);
    if (result.success) {
      showNotification('Gift card voided', 'success');
      load();
    } else {
      showNotification(result.error || 'Failed to void gift card', 'error');
    }
  };

  const handleUpdateBalance = async (id, newBalance) => {
    const num = parseFloat(newBalance);
    if (Number.isNaN(num) || num < 0) return;
    setSaving(true);
    const result = await updateAdminGiftCard(id, { balance: num });
    setSaving(false);
    if (result.success) {
      showNotification('Balance updated', 'success');
      load();
    } else {
      showNotification(result.error || 'Failed to update balance', 'error');
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : '—');
  const purchasedByLabel = (gc) => {
    if (!gc.purchasedBy) return '—';
    const { firstName, lastName, email } = gc.purchasedBy;
    const name = [firstName, lastName].filter(Boolean).join(' ');
    return name ? `${name} (${email})` : email;
  };

  return (
    <div className="admin-gift-cards">
      <div className="admin-gift-cards__header">
        <h1>Gift Cards</h1>
        <button type="button" className="admin-gift-cards__create-btn" onClick={() => setShowCreate(true)}>
          Create Gift Card
        </button>
      </div>

      {showCreate && (
        <div className="admin-gift-cards__create-form">
          <h2>Create Gift Card</h2>
          <form onSubmit={handleCreate}>
            <div className="admin-gift-cards__field">
              <label htmlFor="gc-initialBalance">Amount ($) *</label>
              <input
                id="gc-initialBalance"
                type="number"
                min="0.01"
                step="0.01"
                value={createForm.initialBalance}
                onChange={(e) => setCreateForm((f) => ({ ...f, initialBalance: e.target.value }))}
                required
              />
            </div>
            <div className="admin-gift-cards__field">
              <label htmlFor="gc-recipientEmail">Recipient email (optional)</label>
              <input
                id="gc-recipientEmail"
                type="email"
                value={createForm.recipientEmail}
                onChange={(e) => setCreateForm((f) => ({ ...f, recipientEmail: e.target.value }))}
              />
            </div>
            <div className="admin-gift-cards__field">
              <label htmlFor="gc-purchasedByUserId">Purchased by user ID (optional)</label>
              <input
                id="gc-purchasedByUserId"
                type="text"
                value={createForm.purchasedByUserId}
                onChange={(e) => setCreateForm((f) => ({ ...f, purchasedByUserId: e.target.value }))}
              />
            </div>
            <div className="admin-gift-cards__form-actions">
              <button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-gift-cards__filters">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="admin-gift-cards__table-wrap">
            <table className="admin-gift-cards__table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Initial</th>
                  <th>Balance</th>
                  <th>Spent</th>
                  <th>Status</th>
                  <th>Purchased by</th>
                  <th>Order</th>
                  <th>Recipient</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={10}>No gift cards found.</td>
                  </tr>
                ) : (
                  list.map((gc) => (
                    <tr key={gc.id}>
                      <td><code>{gc.code}</code></td>
                      <td>${Number(gc.initialBalance).toFixed(2)}</td>
                      <td>${Number(gc.balance).toFixed(2)}</td>
                      <td>${(Math.max(0, Number(gc.initialBalance) - Number(gc.balance))).toFixed(2)}</td>
                      <td><span className={`admin-gift-cards__status admin-gift-cards__status--${gc.status}`}>{gc.status}</span></td>
                      <td>{purchasedByLabel(gc)}</td>
                      <td>{gc.orderNumber || (gc.orderId ? `Order ${gc.orderId}` : '—')}</td>
                      <td>{gc.recipientEmail || '—'}</td>
                      <td>{formatDate(gc.createdAt)}</td>
                      <td>
                        {gc.status === 'active' && (
                          <>
                            <button
                              type="button"
                              className="admin-gift-cards__void-btn"
                              onClick={() => handleVoid(gc.id)}
                              disabled={voidingId === gc.id}
                            >
                              {voidingId === gc.id ? 'Voiding…' : 'Void'}
                            </button>
                            <button
                              type="button"
                              className="admin-gift-cards__adj-btn"
                              onClick={() => {
                                const v = prompt('New balance ($):', gc.balance);
                                if (v != null && v !== '') handleUpdateBalance(gc.id, v);
                              }}
                              disabled={saving}
                            >
                              Set balance
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-gift-cards__pagination pagination-footer">
            <Pagination
              page={filters.page}
              totalPages={Math.max(1, pagination.totalPages ?? 1)}
              rowsPerPage={filters.limit}
              total={pagination.total ?? 0}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
              onRowsPerPageChange={(n) => setFilters((f) => ({ ...f, limit: n, page: 1 }))}
              rowsPerPageOptions={[10, 20, 25, 30, 40, 50]}
            />
          </div>
        </>
      )}

      {notification && (
        <NotificationToast
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
    </div>
  );
};

export default AdminGiftCards;

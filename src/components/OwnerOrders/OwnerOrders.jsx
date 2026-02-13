import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { getOrders, getOrder, updateOrder, cancelOrder } from '../../services/ownerService';
import './OwnerOrders.scss';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' }
];

const PAGE_SIZES = [10, 20, 50];

const OwnerOrders = () => {
  const { restaurantId } = useParams();
  const { currentRestaurant } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const restaurant = currentRestaurant?.id === restaurantId ? currentRestaurant : { id: restaurantId, name: '' };

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const offset = (Math.max(1, page) - 1) * limit;
      const params = { limit, offset, restaurantId };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getOrders(params);
      setOrders(res.data || []);
      setPagination(res.pagination || { page: 1, limit, total: 0, totalPages: 0 });
    } catch {
      setOrders([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter, page, limit]);

  const goToPage = (newPage) => {
    const totalPages = Math.max(1, pagination.totalPages || 1);
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const onLimitChange = (e) => {
    const newLimit = Number(e.target.value) || 20;
    setLimit(newLimit);
    setPage(1);
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openDetail = async (orderId) => {
    setDetailOrder(null);
    setDetailLoading(true);
    try {
      const order = await getOrder(orderId, restaurantId ? { restaurantId } : {});
      setDetailOrder(order);
      setEditStatus(order.status || '');
      setEditInstructions(order.deliveryInstructions || '');
    } catch {
      setDetailOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveEdit = async (orderId) => {
    const id = orderId || editOrderId;
    if (!id) return;
    try {
      await updateOrder(id, {
        status: editStatus,
        deliveryInstructions: (editInstructions || '').trim().slice(0, 500) || null
      });
      setEditOrderId(null);
      if (detailOrder?.id === id) setDetailOrder(prev => prev ? { ...prev, status: editStatus, deliveryInstructions: editInstructions } : null);
      fetchOrders();
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to update order');
    }
  };

  const handleCancelOrder = async (order) => {
    try {
      await cancelOrder(order.id);
      setCancelConfirm(null);
      setDetailOrder(null);
      fetchOrders();
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to cancel order');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';
  const formatMoney = (n) => typeof n === 'number' ? `$${Number(n).toFixed(2)}` : '—';
  const formatStatus = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const { total = 0, totalPages: totalPagesFromApi = 1 } = pagination;
  const currentPage = Math.max(1, Math.min(page, totalPagesFromApi || 1));
  const from = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, total);

  if (!restaurantId) return null;

  return (
    <div className="owner-orders">
      <div className="owner-orders__header">
        <h1 className="owner-orders__title">Orders</h1>
        <p className="owner-orders__subtitle">{restaurant.name || restaurantId}</p>
        <div className="owner-orders__actions">
          <select
            value={statusFilter}
            onChange={onStatusFilterChange}
            className="owner-orders__filter"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="owner-orders__limit-label">
            <span>Per page</span>
            <select
              value={limit}
              onChange={onLimitChange}
              className="owner-orders__limit"
              aria-label="Results per page"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="owner-orders__loading">
          <div className="owner-orders__spinner" aria-hidden />
          <p>Loading orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="owner-orders__empty">
          <p>No orders yet.</p>
        </div>
      ) : (
        <div className="owner-orders__table-wrap">
          <table className="owner-orders__table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Status</th>
                <th>Your portion</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Order #">{order.orderNumber || order.id}</td>
                  <td data-label="Date">{formatDate(order.createdAt)}</td>
                  <td data-label="Status"><span className={`owner-orders__status owner-orders__status--${(order.status || '').replace(/_/g, '-')}`}>{formatStatus(order.status)}</span></td>
                  <td data-label="Your portion">{formatMoney(order.ownerSlice?.subtotal != null ? Number(order.ownerSlice.subtotal) : Number(order.total))}</td>
                  <td data-label="Actions">
                    <div className="owner-orders__row-actions">
                      <button type="button" className="owner-orders__btn-view" onClick={() => openDetail(order.id)}>View</button>
                      <button type="button" className="owner-orders__btn-cancel" onClick={() => setCancelConfirm(order)} disabled={order.status === 'cancelled'}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && orders.length > 0 && total > 0 && (
        <div className="owner-orders__pagination">
          <p className="owner-orders__pagination-summary">
            Showing {from}–{to} of {total}
          </p>
          <div className="owner-orders__pagination-controls">
            <button
              type="button"
              className="owner-orders__pagination-btn"
              onClick={() => goToPage(1)}
              disabled={currentPage <= 1}
              aria-label="First page"
            >
              First
            </button>
            <button
              type="button"
              className="owner-orders__pagination-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="owner-orders__pagination-page">
              Page {currentPage} of {Math.max(1, totalPagesFromApi)}
            </span>
            <button
              type="button"
              className="owner-orders__pagination-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= (totalPagesFromApi || 1)}
              aria-label="Next page"
            >
              Next
            </button>
            <button
              type="button"
              className="owner-orders__pagination-btn"
              onClick={() => goToPage(totalPagesFromApi || 1)}
              disabled={currentPage >= (totalPagesFromApi || 1)}
              aria-label="Last page"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="owner-orders__detail-loading">
          <div className="owner-orders__spinner owner-orders__spinner--sm" aria-hidden />
          <p>Loading order…</p>
        </div>
      )}
      {detailOrder && !detailLoading && (() => {
        const displayItems = detailOrder.ownerSlice?.items ?? (restaurantId && detailOrder.restaurantGroups?.[restaurantId]?.items
          ? (Array.isArray(detailOrder.restaurantGroups[restaurantId].items) ? detailOrder.restaurantGroups[restaurantId].items : Object.values(detailOrder.restaurantGroups[restaurantId].items || {}))
          : (Array.isArray(detailOrder.items) ? detailOrder.items : []));
        const displaySubtotal = detailOrder.ownerSlice?.subtotal != null
          ? Number(detailOrder.ownerSlice.subtotal)
          : (displayItems.length ? displayItems.reduce((sum, line) => sum + Number(line.totalPrice ?? (line.price || 0) * (line.quantity || 1)), 0) : null);
        const customerName = detailOrder.user ? [detailOrder.user.firstName, detailOrder.user.lastName].filter(Boolean).join(' ') : (detailOrder.guestInfo?.firstName || detailOrder.guestInfo?.lastName ? [detailOrder.guestInfo.firstName, detailOrder.guestInfo.lastName].filter(Boolean).join(' ') : '—');
        const addr = detailOrder.deliveryAddress;
        const addressStr = addr ? [addr.street, addr.apartment, [addr.city, addr.state, addr.zip_code || addr.zipCode].filter(Boolean).join(', ')].filter(Boolean).join(', ') || '—' : '—';
        return (
        <div className="owner-orders__detail">
          <h2>Order {detailOrder.orderNumber || detailOrder.id}</h2>
          <div className="owner-orders__detail-grid">
            <p><strong>Date:</strong> {formatDate(detailOrder.createdAt)}</p>
            <p><strong>Status:</strong> {formatStatus(detailOrder.status)}</p>
            <p><strong>Customer:</strong> {customerName}</p>
            <p><strong>Delivery address:</strong> {addressStr}</p>
            <p><strong>Delivery instructions:</strong> {detailOrder.deliveryInstructions || '—'}</p>
            {displaySubtotal != null && <p><strong>Your portion:</strong> {formatMoney(displaySubtotal)}</p>}
          </div>
          {displayItems.length > 0 && (
            <div className="owner-orders__items">
              <h3>Items</h3>
              <ul>
                {displayItems.map((line, i) => (
                  <li key={i}>{line.quantity}x {line.name || line.item} {line.selectedVariant?.name ? `(${line.selectedVariant.name})` : ''} — {formatMoney(Number(line.totalPrice ?? (line.price ?? 0) * (line.quantity || 1)))}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="owner-orders__edit">
            <h3>Edit order</h3>
            <div className="owner-orders__edit-row">
              <label>Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="owner-orders__edit-row">
              <label>Delivery instructions</label>
              <textarea value={editInstructions} onChange={(e) => setEditInstructions(e.target.value)} rows={2} />
            </div>
            <div className="owner-orders__edit-actions">
              <button type="button" className="owner-orders__btn-save" onClick={() => handleSaveEdit(detailOrder.id)}>Save changes</button>
              <button type="button" className="owner-orders__btn-close" onClick={() => setDetailOrder(null)}>Close</button>
            </div>
          </div>
        </div>
        );
      })()}

      {cancelConfirm && (
        <div className="owner-orders__modal-overlay" onClick={() => setCancelConfirm(null)}>
          <div className="owner-orders__modal-content" onClick={e => e.stopPropagation()}>
            <div className="owner-orders__modal-header">
              <h4>Cancel order</h4>
              <button type="button" className="owner-orders__modal-close" onClick={() => setCancelConfirm(null)} aria-label="Close">×</button>
            </div>
            <p className="owner-orders__modal-body">Cancel order {cancelConfirm.orderNumber || cancelConfirm.id}? The order will be marked as cancelled.</p>
            <div className="owner-orders__modal-actions">
              <button type="button" className="owner-orders__modal-btn-cancel" onClick={() => setCancelConfirm(null)}>No, keep order</button>
              <button type="button" className="owner-orders__modal-btn-danger" onClick={() => handleCancelOrder(cancelConfirm)}>Yes, cancel order</button>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="owner-orders__modal-overlay" onClick={() => setErrorMessage(null)}>
          <div className="owner-orders__modal-content owner-orders__modal-content--narrow" onClick={e => e.stopPropagation()}>
            <div className="owner-orders__modal-header">
              <h4>Error</h4>
              <button type="button" className="owner-orders__modal-close" onClick={() => setErrorMessage(null)} aria-label="Close">×</button>
            </div>
            <p className="owner-orders__modal-body">{errorMessage}</p>
            <div className="owner-orders__modal-actions">
              <button type="button" className="owner-orders__modal-btn-cancel" onClick={() => setErrorMessage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerOrders;

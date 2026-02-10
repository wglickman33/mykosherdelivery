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

const OwnerOrders = () => {
  const { restaurantId } = useParams();
  const { currentRestaurant } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const restaurant = currentRestaurant?.id === restaurantId ? currentRestaurant : { id: restaurantId, name: '' };

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const params = { limit: 50, offset: 0 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getOrders({ ...params, restaurantId });
      setOrders(res.data || []);
      setPagination(res.pagination || {});
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openDetail = async (orderId) => {
    setDetailOrder(null);
    setDetailLoading(true);
    try {
      const order = await getOrder(orderId);
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
      alert(err?.message || 'Failed to update order');
    }
  };

  const handleCancelOrder = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber || order.id}?`)) return;
    try {
      await cancelOrder(order.id);
      setCancelConfirm(null);
      setDetailOrder(null);
      fetchOrders();
    } catch (err) {
      alert(err?.message || 'Failed to cancel order');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';
  const formatMoney = (n) => typeof n === 'number' ? `$${n.toFixed(2)}` : '—';

  if (!restaurantId) return null;

  return (
    <div className="owner-orders">
      <div className="owner-orders__header">
        <h1 className="owner-orders__title">Orders</h1>
        <p className="owner-orders__subtitle">{restaurant.name || restaurantId}</p>
        <div className="owner-orders__actions">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="owner-orders__filter"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading orders...</p>
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
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber || order.id}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td><span className={`owner-orders__status owner-orders__status--${order.status}`}>{order.status}</span></td>
                  <td>{formatMoney(Number(order.total))}</td>
                  <td>
                    <button type="button" className="owner-orders__btn-view" onClick={() => openDetail(order.id)}>View</button>
                    <button type="button" className="owner-orders__btn-cancel" onClick={() => setCancelConfirm(order)} disabled={order.status === 'cancelled'}>Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailLoading && <p className="owner-orders__detail-loading">Loading order...</p>}
      {detailOrder && !detailLoading && (
        <div className="owner-orders__detail">
          <h2>Order {detailOrder.orderNumber || detailOrder.id}</h2>
          <div className="owner-orders__detail-grid">
            <p><strong>Date:</strong> {formatDate(detailOrder.createdAt)}</p>
            <p><strong>Status:</strong> {detailOrder.status}</p>
            <p><strong>Total:</strong> {formatMoney(Number(detailOrder.total))}</p>
            <p><strong>Delivery instructions:</strong> {detailOrder.deliveryInstructions || '—'}</p>
          </div>
          {Array.isArray(detailOrder.items) && detailOrder.items.length > 0 && (
            <div className="owner-orders__items">
              <h3>Items</h3>
              <ul>
                {detailOrder.items.map((line, i) => (
                  <li key={i}>{line.quantity}x {line.name || line.item} {line.selectedVariant?.name ? `(${line.selectedVariant.name})` : ''} — {formatMoney(Number(line.price || line.totalPrice))}</li>
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
      )}

      {cancelConfirm && (
        <div className="owner-orders__confirm-overlay" onClick={() => setCancelConfirm(null)}>
          <div className="owner-orders__confirm-box" onClick={e => e.stopPropagation()}>
            <p>Cancel order {cancelConfirm.orderNumber || cancelConfirm.id}? The order will be marked as cancelled.</p>
            <div className="owner-orders__confirm-actions">
              <button type="button" className="owner-orders__btn-cancel-no" onClick={() => setCancelConfirm(null)}>No</button>
              <button type="button" className="owner-orders__btn-cancel-yes" onClick={() => handleCancelOrder(cancelConfirm)}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerOrders;

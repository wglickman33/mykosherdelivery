import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchResidentOrders,
  fetchFacilitiesList,
  deleteResidentOrder
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Pagination from '../Pagination/Pagination';
import NotificationToast from '../NotificationToast/NotificationToast';
import { useNotification } from '../../hooks/useNotification';
import './AdminOrders.scss';
import './AdminNursingHomeOrders.scss';

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  paid: 'Paid',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded'
};

const formatPlacedBy = (order) => {
  const creator = order?.createdBy;
  if (!creator) return order?.createdByUserId ? 'Staff / admin' : '—';
  const name = [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (creator.email) return creator.email;
  if (creator.role === 'nursing_home_user') return 'Resident';
  if (creator.role === 'nursing_home_admin') return 'Facility staff';
  if (creator.role === 'admin') return 'Platform admin';
  return creator.role || '—';
};

const AdminNursingHomeOrders = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notification, showNotification, hideNotification } = useNotification();
  const [facilities, setFacilities] = useState([]);
  const [facilityFilter, setFacilityFilter] = useState(searchParams.get('facilityId') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [orderNumberFilter, setOrderNumberFilter] = useState(searchParams.get('orderNumber') || '');
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);

  const loadFacilities = useCallback(async () => {
    try {
      const res = await fetchFacilitiesList({ limit: 200 });
      setFacilities(res?.data || []);
    } catch {
      setFacilities([]);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit };
      if (facilityFilter) params.facilityId = facilityFilter;
      if (statusFilter) params.status = statusFilter;
      if (orderNumberFilter.trim()) params.orderNumber = orderNumberFilter.trim();
      const res = await fetchResidentOrders(params);
      setOrders(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page, total: 0, totalPages: 0, limit });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [facilityFilter, statusFilter, orderNumberFilter, page, limit]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const next = {};
    if (facilityFilter) next.facilityId = facilityFilter;
    if (statusFilter) next.status = statusFilter;
    if (orderNumberFilter.trim()) next.orderNumber = orderNumberFilter.trim();
    if (page > 1) next.page = String(page);
    setSearchParams(next, { replace: true });
  }, [facilityFilter, statusFilter, orderNumberFilter, page, setSearchParams]);

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(`${d}T00:00:00`);
    return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const activeCount = orders.filter((o) => o.status !== 'cancelled').length;

  const handleDelete = async () => {
    if (!orderToDelete?.id) return;
    try {
      setDeleting(true);
      const result = await deleteResidentOrder(orderToDelete.id);
      if (result.success !== false) {
        setOrderToDelete(null);
        showNotification(result.message || 'Order deleted', 'success');
        await loadOrders();
      } else {
        showNotification(result.error || 'Failed to delete order', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to delete order', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-orders admin-nh-orders">
      <div className="orders-header">
        <button
          type="button"
          className="back-to-orders"
          onClick={() => navigate('/admin/orders')}
        >
          ← Back to orders
        </button>
        <div className="header-content">
          <h1>Nursing Home Orders</h1>
          <p>Weekly resident meal orders across facilities. Amounts appear on monthly invoices only.</p>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-label">Total Orders</span>
            <span className="stat-value">{pagination.total || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active Orders</span>
            <span className="stat-value">{activeCount}</span>
          </div>
        </div>
      </div>

      <div className="orders-filters">
        <div className="filter-group">
          <label htmlFor="nh-orders-facility">Facility</label>
          <select
            id="nh-orders-facility"
            value={facilityFilter}
            onChange={(e) => {
              setFacilityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="nh-orders-status">Status</label>
          <select
            id="nh-orders-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Orders</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="confirmed">Confirmed</option>
            <option value="paid">Paid</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="nh-orders-number">Order Number</label>
          <input
            id="nh-orders-number"
            type="text"
            placeholder="Order # or ID"
            value={orderNumberFilter}
            onChange={(e) => {
              setOrderNumberFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      <div className="orders-table-container">
        {loading ? (
          <div className="orders-loading">
            <LoadingSpinner size="large" />
            <p>Loading orders...</p>
          </div>
        ) : (
          <>
            <div className="orders-table-scroll">
              <table className="orders-table">
                <colgroup>
                  <col className="col-order" />
                  <col className="col-facility" />
                  <col className="col-resident" />
                  <col className="col-week" />
                  <col className="col-meals" />
                  <col className="col-status" />
                  <col className="col-placed" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Facility</th>
                    <th>Resident</th>
                    <th>Week</th>
                    <th>Meals</th>
                    <th>Status</th>
                    <th>Placed by</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        No nursing home orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td className="order-number" title={order.orderNumber || order.id}>
                          {order.orderNumber || (order.id ? String(order.id).slice(0, 8) : '—')}
                        </td>
                        <td className="restaurant-name" title={order.facility?.name || '—'}>
                          {order.facility?.name || '—'}
                        </td>
                        <td
                          className="customer-info"
                          title={[
                            order.resident?.name || order.residentName,
                            order.resident?.roomNumber || order.roomNumber
                              ? `Room ${order.resident?.roomNumber || order.roomNumber}`
                              : null
                          ].filter(Boolean).join(' · ')}
                        >
                          <div className="customer-name">
                            {order.resident?.name || order.residentName || '—'}
                          </div>
                          {(order.resident?.roomNumber || order.roomNumber) && (
                            <div className="customer-email">
                              Room {order.resident?.roomNumber || order.roomNumber}
                            </div>
                          )}
                        </td>
                        <td
                          className="customer-info order-date"
                          title={[formatDate(order.weekStartDate), order.weekEndDate ? formatDate(order.weekEndDate) : null]
                            .filter(Boolean)
                            .join(' – ')}
                        >
                          <div className="customer-name">{formatDate(order.weekStartDate)}</div>
                          {order.weekEndDate && (
                            <div className="customer-email">to {formatDate(order.weekEndDate)}</div>
                          )}
                        </td>
                        <td className="order-items">
                          {(order.totalMeals ?? 0) === 1 ? '1 meal' : `${order.totalMeals ?? 0} meals`}
                        </td>
                        <td className="order-status">
                          <span className={`nh-status-badge nh-status-badge--${order.status || 'draft'}`}>
                            {statusLabels[order.status] || order.status || '—'}
                          </span>
                        </td>
                        <td className="order-date">{formatPlacedBy(order)}</td>
                        <td className="order-actions">
                          <div className="order-actions-container">
                            <button
                              type="button"
                              className="view-btn"
                              onClick={() => navigate(`/admin/orders/nursing-homes/${order.id}`)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() => setOrderToDelete(order)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="orders-table-container__pagination pagination-footer">
              <Pagination
                page={pagination.page || page}
                totalPages={Math.max(1, pagination.totalPages || 1)}
                rowsPerPage={limit}
                total={pagination.total}
                onPageChange={setPage}
                onRowsPerPageChange={(n) => {
                  setLimit(n);
                  setPage(1);
                }}
                rowsPerPageOptions={[10, 20, 30, 40, 50]}
              />
            </div>
          </>
        )}
      </div>

      {orderToDelete && (
        <div className="account-modal-overlay" onClick={() => !deleting && setOrderToDelete(null)}>
          <div className="account-modal" onClick={(e) => e.stopPropagation()}>
            <div className="account-modal__header">
              <h2 className="account-modal__title">Delete Order</h2>
              <button
                type="button"
                className="account-modal__close-btn"
                onClick={() => setOrderToDelete(null)}
                disabled={deleting}
              >
                ×
              </button>
            </div>
            <div className="account-modal__content">
              <div className="delete-warning">
                <h3>Are you sure you want to delete this order?</h3>
                <p>
                  <strong>Order #{orderToDelete.orderNumber || orderToDelete.id}</strong>
                </p>
                <p>
                  {orderToDelete.status === 'draft' || orderToDelete.status === 'cancelled'
                    ? 'This will permanently remove the order.'
                    : 'Submitted or billed orders are cancelled, not refunded automatically. Handle any refunds separately.'}
                </p>
                <div className="warning-details">
                  <p>
                    <strong>Resident:</strong>{' '}
                    {orderToDelete.resident?.name || orderToDelete.residentName || '—'}
                  </p>
                  <p>
                    <strong>Facility:</strong> {orderToDelete.facility?.name || '—'}
                  </p>
                  <p>
                    <strong>Status:</strong> {statusLabels[orderToDelete.status] || orderToDelete.status}
                  </p>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setOrderToDelete(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NotificationToast
        message={notification?.message}
        type={notification?.type}
        onClose={hideNotification}
      />
    </div>
  );
};

export default AdminNursingHomeOrders;

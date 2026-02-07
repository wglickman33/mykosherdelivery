import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchResidentOrders, fetchFacilitiesList } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './AdminNursingHomes.scss';

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  paid: 'Paid',
  cancelled: 'Cancelled'
};

const OrdersTab = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [facilities, setFacilities] = useState([]);
  const [facilityFilter, setFacilityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFacilities = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetchFacilitiesList({ limit: 200 });
      setFacilities(res?.data || []);
    } catch {
      setFacilities([]);
    }
  }, [isAdmin]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 50 };
      if (isAdmin && facilityFilter) params.facilityId = facilityFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await fetchResidentOrders(params);
      const body = res?.data;
      setOrders(Array.isArray(body?.data) ? body.data : []);
      setPagination(body?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, facilityFilter, statusFilter, page]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString();
  };

  return (
    <div className="orders-tab">
      <div className="tab-header">
        <h2>Nursing Home Orders</h2>
      </div>

      {isAdmin && facilities.length > 0 && (
        <div className="filters-row">
          <label>
            <span>Facility</span>
            <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
              <option value="">All facilities</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      )}

      {error && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : orders.length === 0 ? (
        <div className="content-placeholder">
          <p>No orders found.</p>
        </div>
      ) : (
        <div className="nursing-table-container">
          <div className="nursing-table-scroll">
            <table className="data-table" role="grid">
            <thead>
              <tr>
                {isAdmin && <th scope="col">Facility</th>}
                <th scope="col">Resident</th>
                <th scope="col">Room</th>
                <th scope="col">Week</th>
                <th scope="col">Status</th>
                <th scope="col">Payment</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  {isAdmin && (
                    <td>{o.facility ? o.facility.name : '—'}</td>
                  )}
                  <td>{o.resident ? o.resident.name : '—'}</td>
                  <td>{o.resident?.roomNumber || '—'}</td>
                  <td>
                    {o.weekStartDate ? formatDate(o.weekStartDate) : '—'}
                  </td>
                  <td>{statusLabels[o.status] || o.status || '—'}</td>
                  <td>{o.paymentStatus || '—'}</td>
                  <td>
                    {o.total != null ? `$${Number(o.total).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {!loading && orders.length > 0 && (pagination.totalPages > 1 || pagination.total > (pagination.limit || 50)) && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {pagination.total > 0 ? ((pagination.page - 1) * (pagination.limit || 50)) + 1 : 0} to{' '}
            {Math.min(pagination.page * (pagination.limit || 50), pagination.total)} of{' '}
            {pagination.total || 0} orders
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="page-info">
              Page {pagination.page || 1} of {Math.max(1, pagination.totalPages || 1)}
            </span>
            <button
              type="button"
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;

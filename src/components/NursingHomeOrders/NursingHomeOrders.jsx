import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchResidentOrders, fetchResidents } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Pagination from '../Pagination/Pagination';
import './NursingHomeOrders.scss';

const NursingHomeOrders = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const residentIdParam = searchParams.get('residentId');

  const [orders, setOrders] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filterResidentId, setFilterResidentId] = useState(residentIdParam || '');

  const facilityId = searchParams.get('facilityId');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: pagination.page, limit: pagination.limit };
      if (filterResidentId) params.residentId = filterResidentId;
      if (facilityId) params.facilityId = facilityId;

      const [ordersRes, residentsRes] = await Promise.all([
        fetchResidentOrders(params),
        residents.length === 0 ? fetchResidents() : Promise.resolve(null)
      ]);

      const ordersList = ordersRes?.data?.data ?? [];
      setOrders(Array.isArray(ordersList) ? ordersList : []);
      if (ordersRes?.data?.pagination) {
        setPagination(prev => ({ ...prev, ...ordersRes.data.pagination }));
      }

      if (residentsRes && Array.isArray(residentsRes?.data?.data)) {
        setResidents(residentsRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterResidentId, facilityId, residents.length]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (residentIdParam && !filterResidentId) setFilterResidentId(residentIdParam);
  }, [residentIdParam, filterResidentId]);

  const handleFilter = () => {
    setPagination(p => ({ ...p, page: 1 }));
    load();
  };

  if (loading && orders.length === 0) {
    return (
      <div className="nursing-home-orders">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const dashboardPath = `/nursing-homes/dashboard${facilityId ? `?facilityId=${facilityId}` : ''}`;

  return (
    <div className="nursing-home-orders">
      <header className="orders-header">
        <button type="button" className="back-btn" onClick={() => navigate(dashboardPath)}>
          ← Dashboard
        </button>
        <h1>Order History</h1>
      </header>

      {error && (
        <ErrorMessage message={error} type="error" />
      )}

      <div className="orders-filters">
        <select
          value={filterResidentId}
          onChange={(e) => setFilterResidentId(e.target.value)}
          aria-label="Filter by resident"
        >
          <option value="">All residents</option>
          {residents.map(r => (
            <option key={r.id} value={r.id}>{r.name}{r.roomNumber ? ` (${r.roomNumber})` : ''}</option>
          ))}
        </select>
        <button type="button" className="btn-primary" onClick={handleFilter}>Apply</button>
      </div>

      <section className="orders-table-wrap">
        <table className="orders-table" role="grid">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Resident</th>
              <th>Week</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="orders-table-empty">
                  No orders found. <button type="button" className="link-btn" onClick={() => navigate(dashboardPath)}>Back to Dashboard</button>
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.resident?.name ?? order.residentName ?? '—'}</td>
                  <td>{order.weekStartDate} – {order.weekEndDate}</td>
                  <td><span className={`status-badge status-${order.status}`}>{order.status}</span></td>
                  <td><span className={`status-badge status-${order.paymentStatus}`}>{order.paymentStatus}</span></td>
                  <td>${parseFloat(order.total || 0).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => navigate(`/nursing-homes/orders/${order.id}`)}
                    >
                      View
                    </button>
                    {order.status === 'draft' && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => navigate(`/nursing-homes/orders/${order.id}/edit`)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="orders-table-wrap__pagination pagination-footer">
          <Pagination
            page={pagination.page}
            totalPages={Math.max(1, pagination.totalPages)}
            rowsPerPage={pagination.limit}
            total={pagination.total}
            onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
            onRowsPerPageChange={(n) => setPagination(prev => ({ ...prev, limit: n, page: 1 }))}
            rowsPerPageOptions={[10, 20, 30, 40, 50]}
          />
        </div>
      </section>
    </div>
  );
};

export default NursingHomeOrders;

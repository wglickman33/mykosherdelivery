import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchResidentOrders,
  fetchFacilitiesList
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Pagination from '../Pagination/Pagination';
import './AdminNursingHomeOrders.scss';

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  paid: 'Paid',
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
  const [facilities, setFacilities] = useState([]);
  const [facilityFilter, setFacilityFilter] = useState(searchParams.get('facilityId') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const res = await fetchResidentOrders(params);
      setOrders(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [facilityFilter, statusFilter, page, limit]);

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
    if (page > 1) next.page = String(page);
    setSearchParams(next, { replace: true });
  }, [facilityFilter, statusFilter, page, setSearchParams]);

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString();
  };

  return (
    <div className="admin-nh-orders">
      <header className="admin-nh-orders__header">
        <div>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate('/admin/orders')}
          >
            ← Back to orders
          </button>
          <h1>Nursing home orders</h1>
          <p>Weekly resident meal orders. Amounts appear on monthly invoices only.</p>
        </div>
      </header>

      <div className="admin-nh-orders__filters">
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
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      {error && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Resident</th>
                  <th>Week</th>
                  <th>Status</th>
                  <th>Placed by</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No nursing home orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.facility?.name || '—'}</td>
                      <td>
                        {o.resident?.name || o.residentName || '—'}
                        {o.resident?.roomNumber || o.roomNumber
                          ? ` · Rm ${o.resident?.roomNumber || o.roomNumber}`
                          : ''}
                      </td>
                      <td>
                        {o.weekStartDate ? formatDate(o.weekStartDate) : '—'}
                        {o.weekEndDate ? ` – ${formatDate(o.weekEndDate)}` : ''}
                      </td>
                      <td>{statusLabels[o.status] || o.status || '—'}</td>
                      <td>{formatPlacedBy(o)}</td>
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => navigate(`/admin/orders/nursing-homes/${o.id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={Math.max(1, pagination.totalPages)}
              rowsPerPage={limit}
              onPageChange={setPage}
              onRowsPerPageChange={(n) => {
                setLimit(n);
                setPage(1);
              }}
              rowsPerPageOptions={[10, 20, 30, 40, 50]}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AdminNursingHomeOrders;

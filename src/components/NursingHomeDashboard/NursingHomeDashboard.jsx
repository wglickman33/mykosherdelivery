import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchResidents,
  fetchResidentOrders,
  nhPath
} from '../../services/nursingHomeService';
import { useNursingHomeFacility } from '../../context/NursingHomeFacilityContext';
import { useAuth } from '../../hooks/useAuth';
import {
  getNextMondayDateString,
  getOrderStatusPill,
  formatNhDeadline
} from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './NursingHomeDashboard.scss';

const NursingHomeDashboard = () => {
  const { facilitySlug: slugParam } = useParams();
  const { facility, facilitySlug: ctxSlug } = useNursingHomeFacility();
  const facilitySlug = slugParam || ctxSlug || facility?.slug;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [residents, setResidents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('mine');

  const isStaff =
    user?.role === 'nursing_home_admin' ||
    user?.role === 'nursing_home_user' ||
    user?.role === 'admin';

  const weekStart = useMemo(() => getNextMondayDateString(), []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = facility?.id ? { facilityId: facility.id } : {};
      const [residentsRes, ordersRes] = await Promise.all([
        fetchResidents({ ...params, limit: 200 }),
        fetchResidentOrders({ ...params, limit: 200 })
      ]);
      setResidents(Array.isArray(residentsRes?.data) ? residentsRes.data : []);
      setOrders(Array.isArray(ordersRes?.data) ? ordersRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    // Prefer assigned residents for NH users; admins default to all
    if (user?.role === 'nursing_home_user') setFilter('mine');
    else setFilter('all');
  }, [user?.role]);

  const orderByResident = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      if (order.weekStartDate !== weekStart) return;
      const existing = map.get(order.residentId);
      if (!existing) {
        map.set(order.residentId, order);
        return;
      }
      const rank = (o) => {
        if (['submitted', 'confirmed', 'paid'].includes(o.status) || o.paymentStatus === 'paid') return 3;
        if (o.status === 'draft') return 2;
        return 1;
      };
      if (rank(order) >= rank(existing)) map.set(order.residentId, order);
    });
    return map;
  }, [orders, weekStart]);

  const visibleResidents = useMemo(() => {
    if (filter === 'all' || !user?.id) return residents;
    return residents.filter((r) => r.assignedUserId === user.id);
  }, [residents, filter, user?.id]);

  const stats = useMemo(() => {
    let ordered = 0;
    let drafts = 0;
    let needs = 0;
    visibleResidents.forEach((r) => {
      const pill = getOrderStatusPill(orderByResident.get(r.id));
      if (pill.key === 'ordered' || pill.key === 'pending') ordered += 1;
      else if (pill.key === 'draft') drafts += 1;
      else needs += 1;
    });
    return {
      total: visibleResidents.length,
      ordered,
      drafts,
      needs
    };
  }, [visibleResidents, orderByResident]);

  const openOrder = (resident) => {
    const order = orderByResident.get(resident.id);
    if (order?.status === 'draft') {
      navigate(nhPath(facilitySlug, `orders/${order.id}/edit`));
      return;
    }
    if (order && order.status !== 'draft') {
      navigate(nhPath(facilitySlug, `orders/${order.id}`));
      return;
    }
    navigate(nhPath(facilitySlug, `order/new/${resident.id}`));
  };

  const communityName = facility?.name;
  const dashboardTitle = !communityName ? 'Dashboard' : `${communityName} Dashboard`;

  if (loading) {
    return (
      <div className="nursing-home-dashboard">
        <div className="nh-dashboard-loading">
          <LoadingSpinner size="large" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nursing-home-dashboard">
        <ErrorMessage message={error} type="error" />
        <button type="button" className="retry-btn" onClick={loadDashboardData}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="nursing-home-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{dashboardTitle}</h1>
          <p>
            Upcoming week starting {weekStart}. Order deadline: {formatNhDeadline()}.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(nhPath(facilitySlug, 'orders'))}
        >
          View all orders
        </button>
      </div>

      <div className="metrics-grid">
        <div className="metric-card residents">
          <div className="metric-content">
            <h3>Residents</h3>
            <p className="metric-value">{stats.total}</p>
          </div>
        </div>
        <div className="metric-card drafts">
          <div className="metric-content">
            <h3>Ordered</h3>
            <p className="metric-value">{stats.ordered}</p>
          </div>
        </div>
        <div className="metric-card pending">
          <div className="metric-content">
            <h3>Needs order</h3>
            <p className="metric-value">{stats.needs}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-residents">
        <div className="dashboard-residents__toolbar">
          <h2>Residents</h2>
          {isStaff && (
            <div className="filter-toggle" role="group" aria-label="Resident filter">
              <button
                type="button"
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={filter === 'mine' ? 'active' : ''}
                onClick={() => setFilter('mine')}
              >
                Mine
              </button>
            </div>
          )}
        </div>

        {visibleResidents.length === 0 ? (
          <p className="empty-residents">
            {filter === 'mine'
              ? 'No residents assigned to you. Switch to All or ask an admin to assign residents.'
              : 'No residents found for this facility.'}
          </p>
        ) : (
          <ul className="resident-list">
            {visibleResidents.map((resident) => {
              const order = orderByResident.get(resident.id);
              const pill = getOrderStatusPill(order);
              const cta =
                pill.key === 'draft'
                  ? 'Edit order'
                  : pill.key === 'ordered' || pill.key === 'pending'
                    ? 'View order'
                    : 'Create order';
              return (
                <li key={resident.id} className="resident-row">
                  <div className="resident-row__info">
                    <span className="resident-row__name">{resident.name}</span>
                    {resident.roomNumber && (
                      <span className="resident-row__room">Room {resident.roomNumber}</span>
                    )}
                  </div>
                  <span className={`status-pill status-pill--${pill.key}`}>{pill.label}</span>
                  <button
                    type="button"
                    className="btn-primary resident-row__cta"
                    onClick={() => openOrder(resident)}
                  >
                    {cta}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NursingHomeDashboard;

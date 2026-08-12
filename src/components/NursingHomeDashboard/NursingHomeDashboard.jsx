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
  formatNhDeadline,
  isStaffPlacedOrder,
  formatAssignedStaffContact,
  ADMIN_ALREADY_ORDERED_MESSAGE
} from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhAdminOrderedModal from '../NursingHomeShared/NhAdminOrderedModal';
import './NursingHomeDashboard.scss';

const assigneeLabel = (resident) => {
  const u = resident?.assignedUser;
  if (!u) return 'Unassigned';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || 'Assigned';
};

const placedByLabel = (order, resident) => {
  if (!order) return null;
  if (isStaffPlacedOrder(order, resident)) return 'Placed by staff';
  if (order.createdBy || order.createdByUserId) return 'Placed by resident';
  return null;
};

const NursingHomeDashboard = () => {
  const { facilitySlug: slugParam } = useParams();
  const { facility, facilitySlug: ctxSlug } = useNursingHomeFacility();
  const facilitySlug = slugParam || ctxSlug || facility?.slug;
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role;
  const isPlatformAdmin = role === 'admin';
  const isNhAdmin = role === 'nursing_home_admin';
  const isNhUser = role === 'nursing_home_user';
  const canToggleFilter = isNhAdmin || isPlatformAdmin;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [residents, setResidents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState(isNhUser ? 'mine' : isNhAdmin ? 'mine' : 'all');
  const [adminOrderedModal, setAdminOrderedModal] = useState(null);

  const weekStart = useMemo(() => getNextMondayDateString(), []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = facility?.id ? { facilityId: facility.id } : {};
      const [residentsRes, ordersRes] = await Promise.all([
        fetchResidents({ ...params, limit: 200, isActive: 'true' }),
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
    if (isNhUser) setFilter('mine');
    else if (isNhAdmin) setFilter('mine');
    else setFilter('all');
  }, [isNhUser, isNhAdmin]);

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
    if (isNhUser) return residents;
    if (filter === 'mine' && user?.id) {
      return residents.filter((r) => r.assignedUserId === user.id);
    }
    return residents;
  }, [residents, filter, user?.id, isNhUser]);

  const stats = useMemo(() => {
    let ordered = 0;
    let drafts = 0;
    let needs = 0;
    let unassigned = 0;
    visibleResidents.forEach((r) => {
      const pill = getOrderStatusPill(orderByResident.get(r.id));
      if (pill.key === 'ordered' || pill.key === 'pending') ordered += 1;
      else if (pill.key === 'draft') drafts += 1;
      else needs += 1;
    });
    if (isNhAdmin || isPlatformAdmin) {
      unassigned = residents.filter((r) => !r.assignedUserId).length;
    }
    return {
      total: visibleResidents.length,
      ordered,
      drafts,
      needs,
      unassigned,
      facilityTotal: residents.length
    };
  }, [visibleResidents, orderByResident, residents, isNhAdmin, isPlatformAdmin]);

  const isStaffPlacedForResident = (order, resident) =>
    isStaffPlacedOrder(order, resident, user?.id);

  const openOrder = (resident) => {
    const order = orderByResident.get(resident.id);
    if (isNhUser && order && isStaffPlacedForResident(order, resident)) {
      setAdminOrderedModal({
        resident,
        order,
        message: ADMIN_ALREADY_ORDERED_MESSAGE,
        contactLabel: formatAssignedStaffContact(resident?.assignedUser)
      });
      return;
    }
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
  const dashboardTitle = isNhUser
    ? 'My Meal Orders'
    : isNhAdmin
      ? `${communityName || 'Facility'} - Staff Dashboard`
      : `${communityName || 'Facility'} - Admin Dashboard`;

  const dashboardSubtitle = isNhUser
    ? `Place your weekly meal order. Week of ${weekStart}. Deadline: ${formatNhDeadline()}.`
    : isNhAdmin
      ? `Manage residents assigned to you in this facility. Week of ${weekStart}. Deadline: ${formatNhDeadline()}.`
      : `Full facility overview. Week of ${weekStart}. Deadline: ${formatNhDeadline()}.`;

  const listHeading = isNhUser
    ? 'Your order'
    : filter === 'mine'
      ? 'Residents assigned to you'
      : 'All facility residents';

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
    <div className={`nursing-home-dashboard nursing-home-dashboard--${role || 'unknown'}`}>
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{dashboardTitle}</h1>
          <p>{dashboardSubtitle}</p>
        </div>
        <div className="dashboard-header__actions">
          {isPlatformAdmin && (
            <button type="button" className="btn-secondary" onClick={() => navigate('/nursing-homes')}>
              Change community
            </button>
          )}
          {(isNhAdmin || isPlatformAdmin) && (
            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/nursing-homes')}>
              Facility admin
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(nhPath(facilitySlug, 'orders'))}
          >
            {isNhUser ? 'My orders' : 'View orders'}
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card residents">
          <div className="metric-content">
            <h3>{isNhUser ? 'Your profile' : filter === 'mine' ? 'My residents' : 'Residents'}</h3>
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
        {(isNhAdmin || isPlatformAdmin) && (
          <div className="metric-card unassigned">
            <div className="metric-content">
              <h3>Unassigned</h3>
              <p className="metric-value">{stats.unassigned}</p>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-residents">
        <div className="dashboard-residents__toolbar">
          <h2>{listHeading}</h2>
          {canToggleFilter && (
            <div className="filter-toggle" role="group" aria-label="Resident filter">
              <button
                type="button"
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                All{isNhAdmin || isPlatformAdmin ? ` (${stats.facilityTotal})` : ''}
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
            {isNhUser
              ? 'No resident profile is linked to your login yet. Contact your facility administrator.'
              : filter === 'mine'
                ? 'No residents are assigned to you yet. Ask a facility admin to assign residents under Staff Assignment.'
                : 'No residents found for this facility.'}
          </p>
        ) : (
          <ul className="resident-list">
            {visibleResidents.map((resident) => {
              const order = orderByResident.get(resident.id);
              const pill = getOrderStatusPill(order);
              const byLabel = placedByLabel(order, resident);
              const staffLocked = isNhUser && order && isStaffPlacedForResident(order, resident);
              const cta = staffLocked
                ? 'Already ordered'
                : pill.key === 'draft'
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
                    {(isNhAdmin || isPlatformAdmin) && filter === 'all' && (
                      <span className="resident-row__assignee">{assigneeLabel(resident)}</span>
                    )}
                    {(isNhAdmin || isPlatformAdmin) && byLabel && (
                      <span className="resident-row__placed-by">{byLabel}</span>
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

      {adminOrderedModal && (
        <NhAdminOrderedModal
          open
          message={adminOrderedModal.message || ADMIN_ALREADY_ORDERED_MESSAGE}
          contactLabel={adminOrderedModal.contactLabel}
          onClose={() => setAdminOrderedModal(null)}
          onViewOrder={
            adminOrderedModal.order?.id
              ? () => {
                  const id = adminOrderedModal.order.id;
                  setAdminOrderedModal(null);
                  navigate(nhPath(facilitySlug, `orders/${id}`));
                }
              : null
          }
        />
      )}
    </div>
  );
};

export default NursingHomeDashboard;

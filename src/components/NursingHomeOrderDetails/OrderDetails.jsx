import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchResidentOrder,
  exportResidentOrder,
  submitResidentOrder,
  nhPath
} from '../../services/nursingHomeService';
import { useNursingHomeFacility } from '../../context/NursingHomeFacilityContext';
import { useAuth } from '../../hooks/useAuth';
import { NH_CONFIG } from '../../config/constants';
import {
  isNoneMeal,
  mealHasItems,
  isStaffPlacedOrder,
  formatAssignedStaffContact,
  ADMIN_ALREADY_ORDERED_MESSAGE
} from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhAdminOrderedModal from '../NursingHomeShared/NhAdminOrderedModal';
import './OrderDetails.scss';

const OrderDetails = () => {
  const { orderId, facilitySlug: slugParam } = useParams();
  const navigate = useNavigate();
  const { facility: contextFacility } = useNursingHomeFacility();
  const { user } = useAuth();
  const facilitySlug = slugParam || contextFacility?.slug;
  const isNhUser = user?.role === 'nursing_home_user';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminConflict, setAdminConflict] = useState(null);

  const ordersListPath = nhPath(facilitySlug, 'orders');

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchResidentOrder(orderId);
      setOrder(data || null);
      if (!data) setError('Order not found');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleExport = async () => {
    if (!orderId) return;
    try {
      setExporting(true);
      const blob = await exportResidentOrder(orderId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${order?.orderNumber || orderId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const staffLocked = useMemo(
    () => isNhUser && isStaffPlacedOrder(order, order?.resident, user?.id),
    [isNhUser, order, user?.id]
  );

  const handleSubmit = async () => {
    if (!order?.id) return;
    if (staffLocked) {
      setAdminConflict({
        message: ADMIN_ALREADY_ORDERED_MESSAGE,
        contactLabel: formatAssignedStaffContact(order?.resident?.assignedUser)
      });
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const submitted = await submitResidentOrder(order.id);
      const id = submitted?.id || order.id;
      navigate(nhPath(facilitySlug, `orders/${id}/confirmation`));
    } catch (err) {
      const code = err.response?.data?.code || err.response?.data?.error;
      if (code === 'ADMIN_ALREADY_ORDERED') {
        setAdminConflict({
          message: err.response?.data?.message || ADMIN_ALREADY_ORDERED_MESSAGE,
          contactLabel: formatAssignedStaffContact(order?.resident?.assignedUser)
        });
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  const isDraft = order?.status === 'draft';
  const canMutate = isDraft && !staffLocked;
  const residentName = order?.residentName ?? order?.resident?.name;
  const roomNumber = order?.roomNumber ?? order?.resident?.roomNumber;
  const mealsByDay = (order?.meals || []).reduce((acc, m) => {
    if (!acc[m.day]) acc[m.day] = [];
    acc[m.day].push(m);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="nursing-home-order-details">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="nursing-home-order-details">
        <ErrorMessage message={error} type="error" />
        <button type="button" className="back-btn" onClick={() => navigate(ordersListPath)}>
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="nursing-home-order-details">
      <header className="details-header">
        <button type="button" className="back-btn" onClick={() => navigate(ordersListPath)}>
          ← Orders
        </button>
        <div className="header-row">
          <h1>Order {order?.orderNumber}</h1>
          <div className="header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            {canMutate && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate(nhPath(facilitySlug, `orders/${order.id}/edit`))}
                >
                  Edit Order
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : 'Submit Order'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}
      {staffLocked && (
        <ErrorMessage
          message={
            formatAssignedStaffContact(order?.resident?.assignedUser)
              ? `${ADMIN_ALREADY_ORDERED_MESSAGE} Contact: ${formatAssignedStaffContact(order.resident.assignedUser)}.`
              : ADMIN_ALREADY_ORDERED_MESSAGE
          }
          type="info"
        />
      )}

      <section className="details-card">
        <h2>Resident</h2>
        <p className="resident-name">{residentName}</p>
        {roomNumber && <p className="room">Room {roomNumber}</p>}
      </section>

      <section className="details-card">
        <h2>Week &amp; totals</h2>
        <div className="detail-rows">
          <div className="detail-row">
            <span>Week</span>
            <span>{order?.weekStartDate} – {order?.weekEndDate}</span>
          </div>
          <div className="detail-row">
            <span>Status</span>
            <span className={`status-badge status-${order?.status}`}>{order?.status}</span>
          </div>
          <div className="detail-row">
            <span>Payment</span>
            <span className={`status-badge status-${order?.paymentStatus}`}>{order?.paymentStatus}</span>
          </div>
          <div className="detail-row">
            <span>Total meals</span>
            <span>{order?.totalMeals}</span>
          </div>
          <div className="detail-row">
            <span>Subtotal</span>
            <span>${parseFloat(order?.subtotal || 0).toFixed(2)}</span>
          </div>
          <div className="detail-row">
            <span>Tax</span>
            <span>${parseFloat(order?.tax || 0).toFixed(2)}</span>
          </div>
          <div className="detail-row total">
            <span>Total</span>
            <span>${parseFloat(order?.total || 0).toFixed(2)}</span>
          </div>
        </div>
      </section>

      <section className="details-card">
        <h2>Meals by day</h2>
        {NH_CONFIG.MEALS.DAYS.map((day) => {
          const meals = mealsByDay[day];
          if (!meals?.length) return null;
          return (
            <div key={day} className="day-block">
              <h3>{day}</h3>
              {meals.map((meal, i) => (
                <div key={i} className="meal-row">
                  <span className="meal-type">{meal.mealType}</span>
                  <span>
                    {isNoneMeal(meal)
                      ? 'None'
                      : mealHasItems(meal)
                        ? `${meal.items.length} items`
                        : '—'}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      {order?.deliveryAddress && (
        <section className="details-card">
          <h2>Delivery</h2>
          <p className="address">
            {[
              order.deliveryAddress.street,
              order.deliveryAddress.city,
              order.deliveryAddress.state,
              order.deliveryAddress.zip_code
            ].filter(Boolean).join(', ')}
          </p>
        </section>
      )}

      <NhAdminOrderedModal
        open={Boolean(adminConflict)}
        message={adminConflict?.message}
        contactLabel={adminConflict?.contactLabel}
        onClose={() => setAdminConflict(null)}
      />
    </div>
  );
};

export default OrderDetails;

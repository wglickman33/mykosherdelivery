import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchResidentOrder, nhPath } from '../../services/nursingHomeService';
import { useNursingHomeFacility } from '../../context/NursingHomeFacilityContext';
import { formatNhWeekRange } from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhMealsByDay from '../NursingHomeShared/NhMealsByDay';
import './OrderConfirmation.scss';

const OrderConfirmation = () => {
  const { orderId, facilitySlug: slugParam } = useParams();
  const navigate = useNavigate();
  const { facility: contextFacility } = useNursingHomeFacility();
  const facilitySlug = slugParam || contextFacility?.slug;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchResidentOrder(orderId);
        if (!cancelled) setOrder(data || null);
        if (!cancelled && !data) setError('Order not found');
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <div className="nursing-home-order-confirmation">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="nursing-home-order-confirmation">
        <ErrorMessage message={error || 'Order not found'} type="error" />
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(nhPath(facilitySlug, 'dashboard'))}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const residentName = order.residentName ?? order.resident?.name;
  const roomNumber = order.roomNumber ?? order.resident?.roomNumber;

  return (
    <div className="nursing-home-order-confirmation">
      <div className="confirmation-card">
        <div className="confirmation-hero">
          <h1>Order submitted</h1>
          <p className="order-number">Order #{order.orderNumber}</p>
          <p className="confirmation-lede">
            Thank you. Your weekly meals are confirmed and ready for the kitchen.
          </p>
        </div>

        <div className="confirmation-meta">
          {residentName && (
            <div className="meta-row">
              <span>Resident</span>
              <span>
                {residentName}
                {roomNumber ? ` · Room ${roomNumber}` : ''}
              </span>
            </div>
          )}
          <div className="meta-row">
            <span>Week</span>
            <span>
              {formatNhWeekRange(order.weekStartDate, order.weekEndDate)}
            </span>
          </div>
          <div className="meta-row">
            <span>Meals ordered</span>
            <span>{order.totalMeals ?? 0}</span>
          </div>
        </div>

        <p className="receipt-note">
          This order will be billed monthly to the card on file
          {order.billingEmail ? ` (${order.billingEmail})` : ''}.
          No payment is charged at submit.
        </p>

        <NhMealsByDay meals={order.meals} title="Your week" />

        <div className="confirmation-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(nhPath(facilitySlug, `orders/${order.id}`))}
          >
            View order
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(nhPath(facilitySlug, 'dashboard'))}
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;

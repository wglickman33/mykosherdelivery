import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  fetchResidentOrder,
  submitResidentOrder,
  nhPath
} from '../../services/nursingHomeService';
import { useNursingHomeFacility } from '../../context/NursingHomeFacilityContext';
import { NH_CONFIG } from '../../config/constants';
import { isNoneMeal, mealHasItems } from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './OrderPayment.scss';

/**
 * Legacy payment route — staff no longer charge cards at checkout.
 * Draft orders are submitted via submitResidentOrder; billing is monthly to the resident card.
 */
const OrderPayment = () => {
  const { orderId, facilitySlug: slugParam } = useParams();
  const navigate = useNavigate();
  const { facility: contextFacility } = useNursingHomeFacility();
  const facilitySlug = slugParam || contextFacility?.slug;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const detailsPath = nhPath(facilitySlug, `orders/${orderId}`);
  const dashboardPath = nhPath(facilitySlug, 'dashboard');

  const isAlreadySubmitted = (data) => {
    if (!data) return false;
    if (data.status === 'draft') return false;
    return ['submitted', 'confirmed', 'paid', 'in_progress', 'completed'].includes(data.status)
      || ['paid', 'pending_monthly'].includes(data.paymentStatus);
  };

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchResidentOrder(orderId);

      if (!data) {
        setError('Order not found');
        return;
      }

      setOrder(data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleSubmit = async () => {
    if (!order?.id) return;
    try {
      setSubmitting(true);
      setError(null);
      const submitted = await submitResidentOrder(order.id);
      const id = submitted?.id || order.id;
      navigate(nhPath(facilitySlug, `orders/${id}/confirmation`), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  const getMealsByDay = () => {
    if (!order?.meals) return {};
    const byDay = {};
    order.meals.forEach((meal) => {
      if (!byDay[meal.day]) byDay[meal.day] = [];
      byDay[meal.day].push(meal);
    });
    return byDay;
  };

  if (loading) {
    return (
      <div className="order-payment">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="order-payment">
        <ErrorMessage message={error} type="error" />
        <button type="button" onClick={() => navigate(dashboardPath)}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (isAlreadySubmitted(order)) {
    return (
      <div className="order-payment">
        <div className="payment-header">
          <h1>Order Already Submitted</h1>
          <p className="order-number">Order #{order?.orderNumber}</p>
        </div>
        <div className="payment-content">
          <div className="order-review">
            <p>
              This order has already been submitted. Billing is handled monthly on the resident&apos;s card —
              no staff payment is needed at checkout.
            </p>
            <p>
              <Link to={detailsPath}>View order details</Link>
            </p>
            <button type="button" className="back-btn" onClick={() => navigate(dashboardPath)}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const mealsByDay = getMealsByDay();
  const days = NH_CONFIG.MEALS.DAYS;

  return (
    <div className="order-payment">
      <div className="payment-header">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Submit Order</h1>
        <p className="order-number">Order #{order?.orderNumber}</p>
      </div>

      <div className="payment-content">
        <div className="order-review">
          <h2>Order Review</h2>

          <div className="resident-info">
            <h3>{order?.residentName ?? order?.resident?.name}</h3>
            {(order?.roomNumber ?? order?.resident?.roomNumber) && (
              <p>Room {order?.roomNumber ?? order?.resident?.roomNumber}</p>
            )}
          </div>

          <div className="order-details">
            <div className="detail-row">
              <span>Week:</span>
              <span>{order?.weekStartDate} to {order?.weekEndDate}</span>
            </div>
            <div className="detail-row">
              <span>Total Meals:</span>
              <span>{order?.totalMeals}</span>
            </div>
          </div>

          <div className="meals-summary">
            <h4>Meals by Day</h4>
            {days.map((day) => {
              const dayMeals = mealsByDay[day];
              if (!dayMeals || dayMeals.length === 0) return null;

              return (
                <div key={day} className="day-meals">
                  <h5>{day}</h5>
                  {dayMeals.map((meal, idx) => (
                    <div key={idx} className="meal-item">
                      <span className="meal-type">{meal.mealType}</span>
                      <span className="meal-count">
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
          </div>

          <div className="order-totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${parseFloat(order?.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span>Tax:</span>
              <span>${parseFloat(order?.tax || 0).toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
              <span>Total:</span>
              <span>${parseFloat(order?.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="payment-section">
          <h2>Submit for Monthly Billing</h2>
          <p>
            Staff do not pay at checkout. Charges are billed monthly to the resident&apos;s card on file.
          </p>

          {error && (
            <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
          )}

          <button
            type="button"
            className="submit-payment-btn"
            onClick={handleSubmit}
            disabled={submitting || order?.status !== 'draft'}
          >
            {submitting ? 'Submitting…' : 'Submit Order'}
          </button>

          <div className="payment-info">
            <h4>Important Information</h4>
            <ul>
              <li>No card charge is taken here — billing is monthly to the resident</li>
              <li>Orders can be modified until Sunday 12:00 PM ET</li>
              <li>A confirmation is shown after submit</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPayment;

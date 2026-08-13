import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchResidentOrder, nhPath } from '../../services/nursingHomeService';
import { useNursingHomeFacility } from '../../context/NursingHomeFacilityContext';
import { NH_CONFIG } from '../../config/constants';
import { isNoneMeal, mealHasItems } from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './OrderConfirmation.scss';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

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

  const mealsByDay = useMemo(() => {
    const byDay = {};
    (order?.meals || []).forEach((meal) => {
      if (!mealHasItems(meal) && !isNoneMeal(meal)) return;
      if (!byDay[meal.day]) byDay[meal.day] = [];
      byDay[meal.day].push(meal);
    });
    Object.keys(byDay).forEach((day) => {
      byDay[day].sort(
        (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)
      );
    });
    return byDay;
  }, [order]);

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
              {order.weekStartDate}
              {order.weekEndDate ? ` – ${order.weekEndDate}` : ''}
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

        <section className="confirmation-meals" aria-label="Meals by day">
          <h2>Your week</h2>
          {NH_CONFIG.MEALS.DAYS.map((day) => {
            const dayMeals = mealsByDay[day];
            if (!dayMeals?.length) return null;
            return (
              <div key={day} className="day-block">
                <h3>{day}</h3>
                {dayMeals.map((meal) => {
                  const none = isNoneMeal(meal);
                  return (
                    <div key={`${meal.day}-${meal.mealType}`} className="meal-block">
                      <div className="meal-heading">
                        <span className="meal-type">{meal.mealType}</span>
                        <span className="meal-status">{none ? 'Skipped' : 'Selected'}</span>
                      </div>
                      {none ? (
                        <p className="meal-item">None</p>
                      ) : (
                        (meal.items || []).map((item) => (
                          <p key={item.id || item.name} className="meal-item">
                            {item.name}
                          </p>
                        ))
                      )}
                      {meal.bagelType && !none && (
                        <p className="bagel-note">Bagel: {meal.bagelType}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>

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

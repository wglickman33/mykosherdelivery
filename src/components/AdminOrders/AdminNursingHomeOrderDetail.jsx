import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchResidentOrder } from '../../services/nursingHomeService';
import { NH_CONFIG } from '../../config/constants';
import { isNoneMeal, mealHasItems } from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './AdminNursingHomeOrderDetail.scss';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

const formatPlacedBy = (order) => {
  const creator = order?.createdBy;
  if (!creator) return '—';
  const name = [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  return creator.email || creator.role || '—';
};

const AdminNursingHomeOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchResidentOrder(orderId);
        if (!cancelled) {
          setOrder(data || null);
          if (!data) setError('Order not found');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load order');
        }
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
      <div className="admin-nh-order-detail">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="admin-nh-order-detail">
        <ErrorMessage message={error || 'Order not found'} type="error" />
        <button
          type="button"
          className="back-link"
          onClick={() => navigate('/admin/orders/nursing-homes')}
        >
          ← Back to nursing home orders
        </button>
      </div>
    );
  }

  const residentName = order.residentName ?? order.resident?.name;
  const roomNumber = order.roomNumber ?? order.resident?.roomNumber;
  const facilityName = order.facility?.name;

  return (
    <div className="admin-nh-order-detail">
      <button
        type="button"
        className="back-link"
        onClick={() => navigate('/admin/orders/nursing-homes')}
      >
        ← Nursing home orders
      </button>

      <header className="admin-nh-order-detail__header">
        <h1>Order {order.orderNumber}</h1>
        <p>
          {[facilityName, residentName, roomNumber ? `Room ${roomNumber}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <section className="detail-card">
        <h2>Overview</h2>
        <div className="detail-rows">
          <div className="detail-row">
            <span>Week</span>
            <span>
              {order.weekStartDate}
              {order.weekEndDate ? ` – ${order.weekEndDate}` : ''}
            </span>
          </div>
          <div className="detail-row">
            <span>Status</span>
            <span>{order.status}</span>
          </div>
          <div className="detail-row">
            <span>Payment</span>
            <span>{order.paymentStatus || '—'}</span>
          </div>
          <div className="detail-row">
            <span>Meals ordered</span>
            <span>{order.totalMeals ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>Placed by</span>
            <span>{formatPlacedBy(order)}</span>
          </div>
        </div>
        <p className="billing-note">
          Dollar amounts are on monthly invoices. Refunds and billing run from the facility Orders tab.
        </p>
      </section>

      <section className="detail-card">
        <h2>Meals by day</h2>
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
                      <span>{none ? 'Skipped' : 'Selected'}</span>
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
    </div>
  );
};

export default AdminNursingHomeOrderDetail;

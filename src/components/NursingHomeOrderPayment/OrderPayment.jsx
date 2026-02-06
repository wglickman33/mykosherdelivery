import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { fetchResidentOrders, submitAndPayOrder } from '../../services/nursingHomeService';
import { NH_CONFIG } from '../../config/constants';
import StripePaymentForm from '../StripePaymentForm/StripePaymentForm';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './OrderPayment.scss';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const OrderPayment = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchResidentOrders({ });
      const foundOrder = response.data?.find(o => o.id === orderId);

      if (!foundOrder) {
        setError('Order not found');
        return;
      }

      if (foundOrder.status !== 'draft' && foundOrder.paymentStatus !== 'pending') {
        navigate(`/nursing-homes/orders/${orderId}`);
        return;
      }

      setOrder(foundOrder);
    } catch (err) {
      console.error('Error loading order:', err);
      setError(err.response?.data?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, navigate]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const createPaymentIntent = async () => {
    const result = await submitAndPayOrder(order.id, {});
    if (!result.success) {
      throw new Error(result.error || 'Failed to create payment intent');
    }
    return {
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId
    };
  };

  const handlePaymentSuccess = () => {
    navigate(`/nursing-homes/orders/${order.id}/confirmation`);
  };

  const handlePaymentError = (errorMessage) => {
    setPaymentError(errorMessage);
  };

  const getMealsByDay = () => {
    if (!order?.meals) return {};
    
    const byDay = {};
    order.meals.forEach(meal => {
      if (!byDay[meal.day]) {
        byDay[meal.day] = [];
      }
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

  if (error) {
    return (
      <div className="order-payment">
        <ErrorMessage message={error} type="error" />
        <button onClick={() => navigate('/nursing-homes/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const mealsByDay = getMealsByDay();
  const days = NH_CONFIG.MEALS.DAYS;

  return (
    <div className="order-payment">
      <div className="payment-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Complete Your Order</h1>
        <p className="order-number">Order #{order?.orderNumber}</p>
      </div>

      <div className="payment-content">
        <div className="order-review">
          <h2>Order Review</h2>
          
          <div className="resident-info">
            <h3>{order?.residentName}</h3>
            {order?.roomNumber && <p>Room {order.roomNumber}</p>}
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
            {days.map(day => {
              const dayMeals = mealsByDay[day];
              if (!dayMeals || dayMeals.length === 0) return null;

              return (
                <div key={day} className="day-meals">
                  <h5>{day}</h5>
                  {dayMeals.map((meal, idx) => (
                    <div key={idx} className="meal-item">
                      <span className="meal-type">{meal.mealType}</span>
                      <span className="meal-count">{meal.items?.length || 0} items</span>
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

          <div className="billing-info">
            <h4>Billing Information</h4>
            {order?.billingEmail && (
              <p>Receipt will be sent to: <strong>{order.billingEmail}</strong></p>
            )}
            {order?.billingName && (
              <p>Billing name: <strong>{order.billingName}</strong></p>
            )}
          </div>
        </div>

        <div className="payment-section">
          <h2>Payment</h2>
          
          {paymentError && (
            <ErrorMessage 
              message={paymentError} 
              type="error"
              onDismiss={() => setPaymentError(null)}
            />
          )}

          <Elements stripe={stripePromise}>
            <StripePaymentForm
              amount={order.total}
              createPaymentIntent={createPaymentIntent}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              saveCardOption={true}
            />
          </Elements>

          <div className="payment-info">
            <h4>Important Information</h4>
            <ul>
              <li>Payment will be charged immediately</li>
              <li>Receipt will be emailed to the billing address</li>
              <li>Orders can be modified until Sunday 12:00 PM</li>
              <li>Refunds available before the deadline</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPayment;

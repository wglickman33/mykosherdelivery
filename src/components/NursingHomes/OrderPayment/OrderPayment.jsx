import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { fetchResidentOrders, submitAndPayOrder } from '../../../services/nursingHomeService';
import './OrderPayment.scss';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const PaymentForm = ({ order, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [saveCard, setSaveCard] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        onError(error.message);
        setProcessing(false);
        return;
      }

      const result = await submitAndPayOrder(order.id, {
        paymentMethodId: paymentMethod.id
      });

      if (result.success) {
        onSuccess(result.data);
      } else {
        onError(result.error || 'Payment failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      onError(err.response?.data?.message || 'Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1e293b',
        '::placeholder': {
          color: '#94a3b8',
        },
      },
      invalid: {
        color: '#dc2626',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="card-element-container">
        <label>Card Information</label>
        <CardElement options={cardElementOptions} />
      </div>

      <div className="save-card-option">
        <label>
          <input
            type="checkbox"
            checked={saveCard}
            onChange={(e) => setSaveCard(e.target.checked)}
          />
          <span>Save card for future orders</span>
        </label>
      </div>

      <button
        type="submit"
        className="submit-payment-btn"
        disabled={!stripe || processing}
      >
        {processing ? 'Processing...' : `Pay $${parseFloat(order.total).toFixed(2)}`}
      </button>

      <div className="payment-security">
        <p><span className="security-icon">🔒</span> Secure payment powered by Stripe</p>
        <p className="security-note">Your payment information is encrypted and secure</p>
      </div>
    </form>
  );
};

const OrderPayment = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
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
  };

  const handlePaymentSuccess = (updatedOrder) => {
    navigate(`/nursing-homes/orders/${updatedOrder.id}/confirmation`);
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
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-payment">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/nursing-homes/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const mealsByDay = getMealsByDay();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
            <div className="payment-error">
              {paymentError}
            </div>
          )}

          <Elements stripe={stripePromise}>
            <PaymentForm
              order={order}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
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

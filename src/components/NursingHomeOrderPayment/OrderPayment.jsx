import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise, createPaymentMethod } from '../../services/paymentServices';
import { fetchResidentOrder, submitAndPayOrder } from '../../services/nursingHomeService';
import { NH_CONFIG } from '../../config/constants';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './OrderPayment.scss';

const cardElementOptions = {
  style: {
    base: { fontSize: '16px', color: '#1e293b', '::placeholder': { color: '#94a3b8' } },
    invalid: { color: '#dc2626' }
  }
};

function PaymentFormInner({ order, billingInfo, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !order) return;

    setIsProcessing(true);
    onError(null);

    try {
      const cardEl = elements.getElement(CardElement);
      const pmResult = await createPaymentMethod(cardEl, {
        name: billingInfo?.name || order.billingName,
        email: billingInfo?.email || order.billingEmail,
        phone: billingInfo?.phone || order.billingPhone
      });
      if (!pmResult?.success || !pmResult?.paymentMethod) {
        onError(pmResult?.error || 'Could not create payment method');
        return;
      }

      // submitAndPayOrder returns API body { success, data?, error?, message? }; backend confirms payment server-side
      const result = await submitAndPayOrder(order.id, {
        paymentMethodId: pmResult.paymentMethod.id,
        billingEmail: billingInfo?.email || order.billingEmail,
        billingName: billingInfo?.name || order.billingName,
        billingPhone: billingInfo?.phone || order.billingPhone
      });

      if (result?.success) {
        onSuccess();
      } else {
        onError(result?.error || result?.message || 'Payment failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Payment failed';
      onError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form-inner">
      <div className="payment-form-inner__card">
        <label className="payment-form-inner__label">Card</label>
        <CardElement options={cardElementOptions} />
      </div>
      <button type="submit" className="payment-form-inner__submit" disabled={!stripe || isProcessing}>
        {isProcessing ? 'Processing…' : `Pay $${parseFloat(order?.total || 0).toFixed(2)}`}
      </button>
    </form>
  );
}

PaymentFormInner.propTypes = {
  order: PropTypes.object,
  billingInfo: PropTypes.object,
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired
};

const OrderPayment = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [billingInfo, setBillingInfo] = useState({ email: '', name: '', phone: '' });

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchResidentOrder(orderId);
      const data = response?.data;

      if (!data) {
        setError('Order not found');
        return;
      }

      if (data.status !== 'draft' && data.paymentStatus !== 'pending') {
        navigate(`/nursing-homes/orders/${orderId}`, { replace: true });
        return;
      }

      setOrder(data);
      setBillingInfo({
        email: data.billingEmail || '',
        name: data.billingName || '',
        phone: data.billingPhone || ''
      });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, navigate]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handlePaymentSuccess = () => {
    navigate(`/nursing-homes/orders/${order.id}/confirmation`, { replace: true });
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

        </div>

        <div className="payment-section">
          <h2>Billing &amp; Payment</h2>

          <div className="billing-fields">
            <label className="billing-field">
              <span>Email (receipt)</span>
              <input
                type="email"
                value={billingInfo.email}
                onChange={(e) => setBillingInfo((p) => ({ ...p, email: e.target.value }))}
                placeholder="billing@example.com"
              />
            </label>
            <label className="billing-field">
              <span>Name</span>
              <input
                type="text"
                value={billingInfo.name}
                onChange={(e) => setBillingInfo((p) => ({ ...p, name: e.target.value }))}
                placeholder="Billing name"
              />
            </label>
            <label className="billing-field">
              <span>Phone</span>
              <input
                type="tel"
                value={billingInfo.phone}
                onChange={(e) => setBillingInfo((p) => ({ ...p, phone: e.target.value }))}
                placeholder="555-1234"
              />
            </label>
          </div>

          {paymentError && (
            <ErrorMessage message={paymentError} type="error" onDismiss={() => setPaymentError(null)} />
          )}

          <Elements stripe={stripePromise}>
            <PaymentFormInner
              order={order}
              billingInfo={billingInfo}
              onSuccess={handlePaymentSuccess}
              onError={setPaymentError}
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

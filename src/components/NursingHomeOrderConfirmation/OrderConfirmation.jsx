import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchResidentOrder } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './OrderConfirmation.scss';

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchResidentOrder(orderId);
        const data = response?.data;
        if (!cancelled) setOrder(data || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load order');
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
        <button className="btn-primary" onClick={() => navigate('/nursing-homes/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="nursing-home-order-confirmation">
      <div className="confirmation-card">
        <h1>Order confirmed</h1>
        <p className="order-number">Order #{order.orderNumber}</p>
        <p className="total">Total: ${parseFloat(order.total || 0).toFixed(2)}</p>
        <p className="receipt-note">
          A receipt has been sent to {order.billingEmail || 'your billing email'}.
        </p>
        <div className="confirmation-actions">
          <button className="btn-primary" onClick={() => navigate(`/nursing-homes/orders/${order.id}`)}>
            View order
          </button>
          <button className="btn-secondary" onClick={() => navigate('/nursing-homes/dashboard')}>
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchResidentOrder, exportResidentOrder } from '../../services/nursingHomeService';
import { NH_CONFIG } from '../../config/constants';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './OrderDetails.scss';

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchResidentOrder(orderId);
      const data = response?.data;
      setOrder(data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load order');
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
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const isDraft = order?.status === 'draft';
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
        <button className="back-btn" onClick={() => navigate('/nursing-homes/orders')}>Back to Orders</button>
      </div>
    );
  }

  return (
    <div className="nursing-home-order-details">
      <header className="details-header">
        <button className="back-btn" onClick={() => navigate('/nursing-homes/orders')}>
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
            {isDraft && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/nursing-homes/order/${order.id}/payment`)}
              >
                Pay Now
              </button>
            )}
          </div>
        </div>
      </header>

      {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}

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
        {NH_CONFIG.MEALS.DAYS.map(day => {
          const meals = mealsByDay[day];
          if (!meals?.length) return null;
          return (
            <div key={day} className="day-block">
              <h3>{day}</h3>
              {meals.map((meal, i) => (
                <div key={i} className="meal-row">
                  <span className="meal-type">{meal.mealType}</span>
                  <span>{meal.items?.length ?? 0} items</span>
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
            {[order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.zip_code].filter(Boolean).join(', ')}
          </p>
        </section>
      )}
    </div>
  );
};

export default OrderDetails;

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchResidentOrder } from '../../services/nursingHomeService';
import {
  formatNhWeekRange,
  formatNhStatusLabel,
  formatNhPaymentLabel
} from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhMealsByDay from '../NursingHomeShared/NhMealsByDay';
import './AdminNursingHomeOrderDetail.scss';

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
              {formatNhWeekRange(order.weekStartDate, order.weekEndDate)}
            </span>
          </div>
          <div className="detail-row">
            <span>Status</span>
            <span>{formatNhStatusLabel(order.status)}</span>
          </div>
          <div className="detail-row">
            <span>Payment</span>
            <span>{formatNhPaymentLabel(order.paymentStatus)}</span>
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

      <NhMealsByDay meals={order.meals} />
    </div>
  );
};

export default AdminNursingHomeOrderDetail;

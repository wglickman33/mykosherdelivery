import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchResidents, fetchResidentOrders } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './NursingHomeDashboard.scss';

const NursingHomeDashboard = () => {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalResidents: 0,
    activeOrders: 0,
    pendingOrders: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const residentsRes = await fetchResidents();
      const ordersRes = await fetchResidentOrders({ status: 'draft' });

      setResidents(residentsRes.data || []);
      
      setStats({
        totalResidents: residentsRes.data?.length || 0,
        activeOrders: ordersRes.data?.filter(o => o.status === 'draft').length || 0,
        pendingOrders: ordersRes.data?.filter(o => o.paymentStatus === 'pending').length || 0
      });
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = (resident) => {
    navigate(`/nursing-homes/order/new/${resident.id}`);
  };

  const handleViewOrders = (resident) => {
    navigate(`/nursing-homes/orders?residentId=${resident.id}`);
  };

  const handleKeyPress = (e, callback, resident) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback(resident);
    }
  };

  if (loading) {
    return (
      <div className="nursing-home-dashboard">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="nursing-home-dashboard">
        <ErrorMessage message={error} type="error" />
        <button 
          onClick={loadDashboardData}
          className="retry-btn"
          aria-label="Retry loading dashboard"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="nursing-home-dashboard">
      <header className="dashboard-header">
        <h1>My Residents</h1>
        <p className="subtitle">Create and manage weekly meal orders for your assigned residents</p>
      </header>

      <section className="stats-cards" aria-label="Dashboard statistics">
        <div className="stat-card" role="group" aria-labelledby="stat-residents">
          <div className="stat-value" id="stat-residents" aria-label={`${stats.totalResidents} assigned residents`}>
            {stats.totalResidents}
          </div>
          <div className="stat-label">Assigned Residents</div>
        </div>
        <div className="stat-card" role="group" aria-labelledby="stat-drafts">
          <div className="stat-value" id="stat-drafts" aria-label={`${stats.activeOrders} draft orders`}>
            {stats.activeOrders}
          </div>
          <div className="stat-label">Draft Orders</div>
        </div>
        <div className="stat-card" role="group" aria-labelledby="stat-pending">
          <div className="stat-value" id="stat-pending" aria-label={`${stats.pendingOrders} pending payment`}>
            {stats.pendingOrders}
          </div>
          <div className="stat-label">Pending Payment</div>
        </div>
      </section>

      {residents.length === 0 ? (
        <section className="empty-state" role="status">
          <p>No residents assigned to you yet.</p>
          <p className="hint">Contact your administrator to assign residents to your account.</p>
        </section>
      ) : (
        <section className="residents-grid" aria-label="Assigned residents list">
          {residents.map((resident) => (
            <article 
              key={resident.id} 
              className="resident-card"
              aria-labelledby={`resident-${resident.id}-name`}
            >
              <div className="resident-header">
                <h3 id={`resident-${resident.id}-name`}>{resident.name}</h3>
                {resident.roomNumber && (
                  <span className="room-badge" aria-label={`Room number ${resident.roomNumber}`}>
                    Room {resident.roomNumber}
                  </span>
                )}
              </div>

              <dl className="resident-details">
                {resident.dietaryRestrictions && (
                  <div className="detail-item">
                    <dt className="detail-label">Dietary:</dt>
                    <dd className="detail-value">{resident.dietaryRestrictions}</dd>
                  </div>
                )}
                {resident.allergies && (
                  <div className="detail-item allergies">
                    <dt className="detail-label">Allergies:</dt>
                    <dd className="detail-value" role="alert">{resident.allergies}</dd>
                  </div>
                )}
                {resident.billingEmail && (
                  <div className="detail-item">
                    <dt className="detail-label">Billing:</dt>
                    <dd className="detail-value">{resident.billingEmail}</dd>
                  </div>
                )}
              </dl>

              <div className="resident-actions">
                <button
                  className="btn-primary"
                  onClick={() => handleCreateOrder(resident)}
                  onKeyPress={(e) => handleKeyPress(e, handleCreateOrder, resident)}
                  aria-label={`Create order for ${resident.name}`}
                >
                  Create Order
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleViewOrders(resident)}
                  onKeyPress={(e) => handleKeyPress(e, handleViewOrders, resident)}
                  aria-label={`View orders for ${resident.name}`}
                >
                  View Orders
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className="dashboard-info">
        <div className="info-card">
          <h3>Weekly Order Deadline</h3>
          <p className="deadline-text">Orders must be submitted by <strong>Sunday 12:00 PM</strong></p>
          <p className="hint">Orders cover Monday-Sunday of the following week</p>
        </div>
        <div className="info-card">
          <h3>Need Help?</h3>
          <p>Contact your facility administrator for assistance with:</p>
          <ul>
            <li>Resident assignments</li>
            <li>Payment issues</li>
            <li>Special dietary requests</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NursingHomeDashboard;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchResidents, fetchResidentOrders } from '../../../services/nursingHomeService';
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

  if (loading) {
    return (
      <div className="nursing-home-dashboard">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nursing-home-dashboard">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="nursing-home-dashboard">
      <div className="dashboard-header">
        <h1>My Residents</h1>
        <p className="subtitle">Create and manage weekly meal orders for your assigned residents</p>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-value">{stats.totalResidents}</div>
          <div className="stat-label">Assigned Residents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.activeOrders}</div>
          <div className="stat-label">Draft Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pendingOrders}</div>
          <div className="stat-label">Pending Payment</div>
        </div>
      </div>

      {residents.length === 0 ? (
        <div className="empty-state">
          <p>No residents assigned to you yet.</p>
          <p className="hint">Contact your administrator to assign residents to your account.</p>
        </div>
      ) : (
        <div className="residents-grid">
          {residents.map((resident) => (
            <div key={resident.id} className="resident-card">
              <div className="resident-header">
                <h3>{resident.name}</h3>
                {resident.roomNumber && (
                  <span className="room-badge">Room {resident.roomNumber}</span>
                )}
              </div>

              <div className="resident-details">
                {resident.dietaryRestrictions && (
                  <div className="detail-item">
                    <span className="detail-label">Dietary:</span>
                    <span className="detail-value">{resident.dietaryRestrictions}</span>
                  </div>
                )}
                {resident.allergies && (
                  <div className="detail-item allergies">
                    <span className="detail-label">Allergies:</span>
                    <span className="detail-value">{resident.allergies}</span>
                  </div>
                )}
                {resident.billingEmail && (
                  <div className="detail-item">
                    <span className="detail-label">Billing:</span>
                    <span className="detail-value">{resident.billingEmail}</span>
                  </div>
                )}
              </div>

              <div className="resident-actions">
                <button
                  className="btn-primary"
                  onClick={() => handleCreateOrder(resident)}
                >
                  Create Order
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleViewOrders(resident)}
                >
                  View Orders
                </button>
              </div>
            </div>
          ))}
        </div>
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

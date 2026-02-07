import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchResidents, fetchResidentOrders } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './NursingHomeDashboard.scss';

const IS_404_MESSAGE = 'The requested resource was not found.';

const NursingHomeDashboard = () => {
  const [searchParams] = useSearchParams();
  const facilityId = searchParams.get('facilityId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [stats, setStats] = useState({
    totalResidents: 0,
    draftOrders: 0,
    pendingPayment: 0
  });
  const navigate = useNavigate();

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setApiUnavailable(false);
      const params = facilityId ? { facilityId } : {};
      const [residentsRes, ordersRes] = await Promise.all([
        fetchResidents(params),
        fetchResidentOrders(params)
      ]);
      const residentsList = residentsRes?.data?.data ?? [];
      const allOrders = ordersRes?.data?.data ?? [];
      setStats({
        totalResidents: Array.isArray(residentsList) ? residentsList.length : 0,
        draftOrders: (allOrders ?? []).filter((o) => o.status === 'draft').length,
        pendingPayment: (allOrders ?? []).filter((o) => o.paymentStatus === 'pending').length
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('not found') || msg === IS_404_MESSAGE) {
        setApiUnavailable(true);
        setStats({ totalResidents: 0, draftOrders: 0, pendingPayment: 0 });
      } else {
        setError(err.response?.data?.message || msg || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const search = searchParams.toString();
  const ordersPath = `/nursing-homes/orders${search ? `?${search}` : ''}`;

  if (loading) {
    return (
      <div className="nursing-home-dashboard">
        <div className="nh-dashboard-loading">
          <LoadingSpinner size="large" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nursing-home-dashboard">
        <ErrorMessage message={error} type="error" />
        <button type="button" className="retry-btn" onClick={loadDashboardData}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="nursing-home-dashboard">
      {apiUnavailable && (
        <div className="nh-api-unavailable" role="status">
          <p>Nursing home data is not available on this server. Deploy the latest backend (with nursing-home routes) to see metrics.</p>
        </div>
      )}

      <div className="dashboard-header">
        <div className="header-content">
          <h1>Dashboard Overview</h1>
          <p>Resident meals and orders at a glance</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card residents">
          <div className="metric-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="metric-content">
            <h3>Assigned Residents</h3>
            <p className="metric-value">{stats.totalResidents.toLocaleString()}</p>
          </div>
        </div>

        <div className="metric-card drafts">
          <div className="metric-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z" />
            </svg>
          </div>
          <div className="metric-content">
            <h3>Draft Orders</h3>
            <p className="metric-value">{stats.draftOrders.toLocaleString()}</p>
          </div>
        </div>

        <div className="metric-card pending">
          <div className="metric-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
            </svg>
          </div>
          <div className="metric-content">
            <h3>Pending Payment</h3>
            <p className="metric-value">{stats.pendingPayment.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-actions">
        <button type="button" className="btn-primary" onClick={() => navigate(ordersPath)}>
          View Orders
        </button>
      </div>
    </div>
  );
};

export default NursingHomeDashboard;

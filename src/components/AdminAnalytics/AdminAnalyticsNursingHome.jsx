import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import AnalyticsNavigation from './AnalyticsNavigation';
import { fetchNursingHomeAnalytics } from '../../services/adminServices';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);

const AdminAnalyticsNursingHome = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchNursingHomeAnalytics();
      if (result.success && result.data) setData(result.data);
      else setData(null);
    } catch (err) {
      console.error('Error fetching nursing home analytics:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="admin-analytics">
        <AnalyticsNavigation />
        <div className="admin-analytics-loading">
          <LoadingSpinner />
          <p>Loading nursing home analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-content">
              <h3>Facilities</h3>
              <p className="metric-value">{(data?.facilityCount ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Orders (completed/confirmed)</h3>
              <p className="metric-value">{(data?.orderCount ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Invoices</h3>
              <p className="metric-value">{(data?.invoiceCount ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Revenue (orders)</h3>
              <p className="metric-value">{formatCurrency(data?.revenueFromOrders)}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Revenue (invoices)</h3>
              <p className="metric-value">{formatCurrency(data?.revenueFromInvoices)}</p>
            </div>
          </div>
          <div className="metric-card" style={{ borderLeftColor: '#10b981' }}>
            <div className="metric-content">
              <h3>Total B2B revenue</h3>
              <p className="metric-value">{formatCurrency(data?.totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsNursingHome;

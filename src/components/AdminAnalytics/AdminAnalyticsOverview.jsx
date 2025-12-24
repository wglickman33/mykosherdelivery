import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MaterialChart from './MaterialChart';
import AdminAnalyticsTheme from './AdminAnalyticsTheme';
import AnalyticsNavigation from './AnalyticsNavigation';
import { 
  fetchComprehensiveAnalytics, 
  fetchRevenueTrends,
  fetchOrderVolumeTrends
} from '../../services/adminServices';

const AdminAnalyticsOverview = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revenuePeriod, setRevenuePeriod] = useState('quarterly');
  const [orderVolumePeriod, setOrderVolumePeriod] = useState('quarterly');
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [orderVolumeTrends, setOrderVolumeTrends] = useState([]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const fetchOverviewData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch comprehensive analytics (overview cards)
      const analyticsResult = await fetchComprehensiveAnalytics();
      if (analyticsResult.success) {
        setAnalyticsData(analyticsResult.data);
      }

      // Fetch revenue trends
      const revenueResult = await fetchRevenueTrends(revenuePeriod);
      if (revenueResult.success) {
        setRevenueTrends(revenueResult.data);
      }

      // Fetch order volume trends
      const orderVolumeResult = await fetchOrderVolumeTrends(orderVolumePeriod);
      if (orderVolumeResult.success) {
        setOrderVolumeTrends(orderVolumeResult.data);
      }
    } catch (error) {
      console.error('Error fetching overview analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [revenuePeriod, orderVolumePeriod]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  if (loading) {
    return (
      <div className="admin-analytics-loading">
        <LoadingSpinner />
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="admin-analytics-error">
        <p>Failed to load analytics data. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        {/* Overview Cards */}
        <div className="metrics-grid">
          <div className="metric-card revenue">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Total Revenue</h3>
              <p className="metric-value">{formatCurrency(analyticsData.overview.totalRevenue)}</p>
              <span className="metric-change neutral">Live</span>
            </div>
          </div>
          
          <div className="metric-card orders">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Total Orders</h3>
              <p className="metric-value">{analyticsData.overview.totalOrders.toLocaleString()}</p>
              <span className="metric-change neutral">Live</span>
            </div>
          </div>

          <div className="metric-card users">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Active Users</h3>
              <p className="metric-value">{analyticsData.overview.activeUsers.toLocaleString()}</p>
              <span className="metric-change neutral">Live</span>
            </div>
          </div>

          <div className="metric-card restaurants">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41-5.51-5.51z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Average Order Value</h3>
              <span className="metric-value">{formatCurrency(analyticsData.overview.totalRevenue / Math.max(analyticsData.overview.activeUsers, 1))}</span>
            </div>
          </div>
        </div>

        {/* Order Status Breakdown Cards */}
        <div className="metrics-grid">
          <div className="metric-card pending">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Pending Orders</h3>
              <p className="metric-value">{analyticsData.orderStatusBreakdown?.pending || 0}</p>
              <span className="metric-change neutral">Awaiting Confirmation</span>
            </div>
          </div>

          <div className="metric-card confirmed">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Confirmed Orders</h3>
              <p className="metric-value">{analyticsData.orderStatusBreakdown?.confirmed || 0}</p>
              <span className="metric-change neutral">Restaurant Preparing</span>
            </div>
          </div>

          <div className="metric-card preparing">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41-5.51-5.51z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Preparing Orders</h3>
              <p className="metric-value">{analyticsData.orderStatusBreakdown?.preparing || 0}</p>
              <span className="metric-change neutral">Picked Up and Packaging</span>
            </div>
          </div>

          <div className="metric-card out-for-delivery">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Out for Delivery</h3>
              <p className="metric-value">{analyticsData.orderStatusBreakdown?.out_for_delivery || 0}</p>
              <span className="metric-change neutral">On the Way</span>
            </div>
          </div>

          <div className="metric-card delivered">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Delivered Orders</h3>
              <p className="metric-value">{analyticsData.orderStatusBreakdown?.delivered || 0}</p>
              <span className="metric-change neutral">Completed</span>
            </div>
          </div>

          <div className="metric-card cancelled">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Cancelled Orders</h3>
              <p className="metric-value">{analyticsData.orderStatusBreakdown?.cancelled || 0}</p>
              <span className="metric-change neutral">Cancelled</span>
            </div>
          </div>
        </div>

        {/* Revenue & Order Trends Charts */}
        <div className="charts-grid">
          {/* Revenue Trends Chart */}
          <div className="chart-section">
            <div className="chart-header">
              <h3>Revenue Trends</h3>
              <div className="chart-controls">
                <select 
                  value={revenuePeriod} 
                  onChange={(e) => setRevenuePeriod(e.target.value)}
                  className="period-selector"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>
            
            <ThemeProvider theme={AdminAnalyticsTheme}>
              <MaterialChart
                data={revenueTrends}
                valueKey="revenue"
                labelKey="period"
                chartColor="#3b82f6"
                period={revenuePeriod}
                title=""
                type="line"
                tooltipContent={(item) => (
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {item.label}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Revenue:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(item.revenue)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Orders:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {item.orders.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Avg Order Value:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(item.avgOrderValue)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              />
            </ThemeProvider>
          </div>

          {/* Order Volume Trends Chart */}
          <div className="chart-section">
            <div className="chart-header">
              <h3>Order Volume Trends</h3>
              <div className="chart-controls">
                <select 
                  value={orderVolumePeriod} 
                  onChange={(e) => setOrderVolumePeriod(e.target.value)}
                  className="period-selector"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>

            <ThemeProvider theme={AdminAnalyticsTheme}>
              <MaterialChart
                data={orderVolumeTrends}
                valueKey="orders"
                labelKey="period"
                chartColor="#10b981"
                period={orderVolumePeriod}
                title=""
                type="bar"
                tooltipContent={(item) => (
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {item.label}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Orders:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {item.orders.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Revenue:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(item.revenue)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Avg Order Value:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(item.avgOrderValue)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              />
            </ThemeProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsOverview;

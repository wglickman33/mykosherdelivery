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
  fetchRevenueByRestaurant,
  fetchRevenueByTimeOfDay,
  fetchRevenueByDayOfWeek,
  fetchTopRevenueUsers,
  fetchTaxProfitAnalytics
} from '../../services/adminServices';

const AdminAnalyticsRevenue = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revenuePeriod, setRevenuePeriod] = useState('quarterly');
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [revenueByRestaurant, setRevenueByRestaurant] = useState([]);
  const [revenueByTimeOfDay, setRevenueByTimeOfDay] = useState([]);
  const [revenueByDayOfWeek, setRevenueByDayOfWeek] = useState([]);
  const [topRevenueUsers, setTopRevenueUsers] = useState([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const fetchRevenueData = useCallback(async () => {
    try {
      setLoading(true);
      
      const analyticsResult = await fetchComprehensiveAnalytics();
      if (analyticsResult.success) {
        setAnalyticsData(analyticsResult.data);
      }

      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      const breakdownParams = { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };

      const [
        trendsResult,
        restaurantResult,
        timeOfDayResult,
        dayOfWeekResult,
        topUsersResult,
        taxProfitResult
      ] = await Promise.all([
        fetchRevenueTrends(revenuePeriod),
        fetchRevenueByRestaurant('30d'),
        fetchRevenueByTimeOfDay('30d'),
        fetchRevenueByDayOfWeek('30d'),
        fetchTopRevenueUsers('30d'),
        fetchTaxProfitAnalytics(breakdownParams)
      ]);

      if (trendsResult.success) setRevenueTrends(trendsResult.data);
      if (restaurantResult.success) setRevenueByRestaurant(restaurantResult.data);
      if (timeOfDayResult.success) setRevenueByTimeOfDay(timeOfDayResult.data);
      if (dayOfWeekResult.success) setRevenueByDayOfWeek(dayOfWeekResult.data);
      if (topUsersResult.success) setTopRevenueUsers(topUsersResult.data);
      if (taxProfitResult.success && taxProfitResult.data?.revenue) setRevenueBreakdown(taxProfitResult.data.revenue);
      else setRevenueBreakdown(null);
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [revenuePeriod]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  if (loading) {
    return (
      <div className="admin-analytics-loading">
        <LoadingSpinner />
        <p>Loading revenue analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="admin-analytics-error">
        <p>Failed to load revenue analytics. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        {}
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
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>
          
          <div className="metric-card orders">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Average Order Value</h3>
              <p className="metric-value">{formatCurrency(analyticsData.overview.avgOrderValue)}</p>
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>

          <div className="metric-card users">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Revenue per User</h3>
              <p className="metric-value">{formatCurrency(analyticsData.overview.totalRevenue / Math.max(analyticsData.overview.activeUsers, 1))}</p>
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>

          <div className="metric-card restaurants">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41-5.51-5.51z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Revenue per Restaurant</h3>
              <span className="metric-value">{formatCurrency(analyticsData.overview.totalRevenue / Math.max(analyticsData.overview.activeRestaurants, 1))}</span>
            </div>
          </div>
        </div>

        {revenueBreakdown != null && (
          <div className="chart-section">
            <h3>Revenue breakdown (last 30 days)</h3>
            <p style={{ color: '#64748b', marginBottom: '12px' }}>Composition of order revenue by type</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxWidth: '400px' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}><span>Subtotal</span><span>{formatCurrency(revenueBreakdown.subtotal)}</span></li>
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}><span>Delivery fee</span><span>{formatCurrency(revenueBreakdown.deliveryFee)}</span></li>
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}><span>Tips</span><span>{formatCurrency(revenueBreakdown.tip)}</span></li>
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}><span>Tax collected</span><span>{formatCurrency(revenueBreakdown.tax)}</span></li>
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}><span>Discounts</span><span>{formatCurrency(revenueBreakdown.discountAmount)}</span></li>
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 600 }}><span>Total revenue</span><span>{formatCurrency(revenueBreakdown.total)}</span></li>
            </ul>
          </div>
        )}

        {}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Revenue Trends by {revenuePeriod.charAt(0).toUpperCase() + revenuePeriod.slice(1)}</h3>
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

        {}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Revenue by Restaurant (Top 10)</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={revenueByRestaurant}
              valueKey="revenue"
              labelKey="restaurant"
              chartColor="#10b981"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.restaurant}
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
                        {item.orderCount.toLocaleString()}
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

        {}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Revenue by Time of Day</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={revenueByTimeOfDay}
              valueKey="revenue"
              labelKey="time"
              chartColor="#f59e0b"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.time} ({item.period})
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

        {}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Revenue by Day of Week</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={revenueByDayOfWeek}
              valueKey="revenue"
              labelKey="day"
              chartColor="#8b5cf6"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.day}
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

        {}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Top 10 Revenue Users</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={topRevenueUsers}
              valueKey="revenue"
              labelKey="user"
              chartColor="#ef4444"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.user}
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
                        {item.orderCount.toLocaleString()}
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
  );
};

export default AdminAnalyticsRevenue;

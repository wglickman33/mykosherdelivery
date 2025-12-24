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
  fetchOrderVolumeTrends,
  fetchOrderSizeDistribution,
  fetchOrdersByDayOfWeek,
  fetchOrderTypeDistribution,
  fetchTopOrderingUsers,
  fetchOrdersByTimeAndDay
} from '../../services/adminServices';

const AdminAnalyticsOrders = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderVolumePeriod, setOrderVolumePeriod] = useState('quarterly');
  const [orderVolumeTrends, setOrderVolumeTrends] = useState([]);
  const [orderSizeDistribution, setOrderSizeDistribution] = useState([]);
  const [ordersByDayOfWeek, setOrdersByDayOfWeek] = useState([]);
  const [orderTypeDistribution, setOrderTypeDistribution] = useState([]);
  const [topOrderingUsers, setTopOrderingUsers] = useState([]);
  const [ordersByTimeAndDay, setOrdersByTimeAndDay] = useState([]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const fetchOrdersData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch comprehensive analytics for overview
      const analyticsResult = await fetchComprehensiveAnalytics();
      if (analyticsResult.success) {
        setAnalyticsData(analyticsResult.data);
      }

      // Fetch all orders-related data
      const [
        volumeResult,
        sizeResult,
        dayOfWeekResult,
        typeResult,
        topUsersResult,
        timeAndDayResult
      ] = await Promise.all([
        fetchOrderVolumeTrends(orderVolumePeriod),
        fetchOrderSizeDistribution('30d'),
        fetchOrdersByDayOfWeek('30d'),
        fetchOrderTypeDistribution('30d'),
        fetchTopOrderingUsers('30d'),
        fetchOrdersByTimeAndDay('30d')
      ]);

      if (volumeResult.success) setOrderVolumeTrends(volumeResult.data);
      if (sizeResult.success) setOrderSizeDistribution(sizeResult.data);
      if (dayOfWeekResult.success) setOrdersByDayOfWeek(dayOfWeekResult.data);
      if (typeResult.success) setOrderTypeDistribution(typeResult.data);
      if (topUsersResult.success) setTopOrderingUsers(topUsersResult.data);
      if (timeAndDayResult.success) setOrdersByTimeAndDay(timeAndDayResult.data);
    } catch (error) {
      console.error('Error fetching orders analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [orderVolumePeriod]);

  useEffect(() => {
    fetchOrdersData();
  }, [fetchOrdersData]);

  if (loading) {
    return (
      <div className="admin-analytics-loading">
        <LoadingSpinner />
        <p>Loading orders analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="admin-analytics-error">
        <p>Failed to load orders analytics. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        {/* Orders Overview Cards */}
        <div className="metrics-grid">
          <div className="metric-card revenue">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Total Orders</h3>
              <p className="metric-value">{analyticsData.overview.totalOrders.toLocaleString()}</p>
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>
          
          <div className="metric-card orders">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
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
              <h3>Orders per User</h3>
              <p className="metric-value">{(analyticsData.overview.totalOrders / Math.max(analyticsData.overview.activeUsers, 1)).toFixed(1)}</p>
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>

          <div className="metric-card restaurants">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Multi-Restaurant Orders</h3>
              <span className="metric-value">{orderTypeDistribution.length > 1 ? `${orderTypeDistribution.find(t => t.type === 'Multi-Restaurant')?.percentage || 0}%` : '0%'}</span>
            </div>
          </div>
        </div>

        {/* Order Volume Trends Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Order Volume Trends by {orderVolumePeriod.charAt(0).toUpperCase() + orderVolumePeriod.slice(1)}</h3>
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

        {/* Order Size Distribution Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Order Size Distribution</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={orderSizeDistribution}
              valueKey="count"
              labelKey="range"
              chartColor="#10b981"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.range}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Orders:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.count.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Percentage:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.percentage}%
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

        {/* Orders by Day of Week Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Orders by Day of Week</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={ordersByDayOfWeek}
              valueKey="orders"
              labelKey="day"
              chartColor="#f59e0b"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.day}
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

        {/* Order Status Distribution Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Order Status Distribution</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={[
                { status: 'Pending', count: analyticsData.orderStatusBreakdown?.pending || 0, color: '#f59e0b', description: 'Orders awaiting confirmation' },
                { status: 'Confirmed', count: analyticsData.orderStatusBreakdown?.confirmed || 0, color: '#3b82f6', description: 'Orders confirmed and being prepared' },
                { status: 'Preparing', count: analyticsData.orderStatusBreakdown?.preparing || 0, color: '#8b5cf6', description: 'Picked up and being packaged' },
                { status: 'Out For Delivery', count: analyticsData.orderStatusBreakdown?.out_for_delivery || 0, color: '#10b981', description: 'Orders out for delivery' },
                { status: 'Delivered', count: analyticsData.orderStatusBreakdown?.delivered || 0, color: '#059669', description: 'Orders successfully delivered' },
                { status: 'Cancelled', count: analyticsData.orderStatusBreakdown?.cancelled || 0, color: '#ef4444', description: 'Orders that were cancelled' }
              ]}
              valueKey="count"
              labelKey="status"
              chartColor="#3b82f6"
              title=""
              type="pie"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.status}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Orders:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.count.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>

        {/* Order Type Distribution Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Multi-Restaurant vs Single Restaurant Orders</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={orderTypeDistribution.map(item => ({ ...item, description: item.type === 'Single Restaurant' ? 'Orders from one restaurant' : 'Orders from multiple restaurants' }))}
              valueKey="count"
              labelKey="type"
              chartColor="#8b5cf6"
              title=""
              type="pie"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.type}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Orders:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.count.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Percentage:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.percentage}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>

        {/* Top Ordering Users Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Top 10 Ordering Users</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={topOrderingUsers}
              valueKey="orderCount"
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
                      <Typography variant="body2" color="text.secondary">Orders:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.orderCount.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Total Spent:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(item.totalSpent)}
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

        {/* Orders by Time of Day Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Orders by Time of Day</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={(() => {
                // Aggregate orders by hour only (not by day)
                const hourlyData = Array(24).fill(0).map((_, hour) => ({
                  hour: hour,
                  time: hour === 0 ? '12:00 AM' : 
                        hour < 12 ? `${hour}:00 AM` : 
                        hour === 12 ? '12:00 PM' : 
                        `${hour - 12}:00 PM`,
                  orders: 0,
                  revenue: 0
                }));

                // Aggregate all orders by hour
                ordersByTimeAndDay.forEach(item => {
                  hourlyData[item.hour].orders += item.orders;
                  hourlyData[item.hour].revenue += item.revenue;
                });

                // Calculate average order value
                hourlyData.forEach(hour => {
                  hour.avgOrderValue = hour.orders > 0 ? hour.revenue / hour.orders : 0;
                });

                return hourlyData;
              })()}
              valueKey="orders"
              labelKey="time"
              chartColor="#06b6d4"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.time}
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
  );
};

export default AdminAnalyticsOrders;

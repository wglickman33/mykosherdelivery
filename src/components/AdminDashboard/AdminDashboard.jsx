import './AdminDashboard.scss';
import { useState, useEffect } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import Chart from './Chart';
import { fetchDashboardStats, fetchRecentOrders, fetchQuarterlyRevenueData, fetchWeeklyOrdersData } from '../../services/adminServices';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [chartData, setChartData] = useState({ revenue: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [statsResult, ordersResult, revenueData, ordersData] = await Promise.all([
          fetchDashboardStats(timeRange),
          fetchRecentOrders(10, timeRange),
          fetchQuarterlyRevenueData(),
          fetchWeeklyOrdersData()
        ]);

        if (statsResult.success && ordersResult.success) {
          const normalizeStatus = (s) => {
            if (!s) return 'unknown';
            const n = s === 'ready' ? 'preparing' : s;
            return n.replace(/_/g, ' ');
          };

          const resolveRestaurantName = (order) => {
            try {
              if (order.restaurant?.name) return order.restaurant.name;
              if (Array.isArray(order.restaurants) && order.restaurants.length > 0) {
                return order.restaurants.map(r => r.name).join(', ');
              }
              if (order.restaurantGroups && typeof order.restaurantGroups === 'object') {
                const ids = Object.keys(order.restaurantGroups);
                if (ids.length > 0) {
                  const names = ids.map(id => {
                    const r = order.restaurants?.find(x => String(x.id) === String(id));
                    return r?.name || id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  });
                  return names.join(', ');
                }
              }
              return '—';
            } catch {
              return '—';
            }
          };

          const resolveCustomerName = (order) => {
            if (order.user) {
              const fn = order.user.firstName || '';
              const ln = order.user.lastName || '';
              return `${fn} ${ln}`.trim() || 'User';
            }
            if (order.guestInfo) {
              const fn = order.guestInfo.firstName || '';
              const ln = order.guestInfo.lastName || '';
              return `${fn} ${ln}`.trim() || 'Guest';
            }
            return order.customer || 'Guest';
          };

          const normalizeAmount = (order) => Number(order.total ?? order.amount ?? 0);

          const recentOrders = (Array.isArray(ordersResult.data) ? ordersResult.data : ordersResult.data?.data || [])
            .map(o => ({
              ...o,
              __display: {
                customer: resolveCustomerName(o),
                restaurant: resolveRestaurantName(o),
                status: normalizeStatus(o.status),
                amount: normalizeAmount(o)
              }
            }));

          setDashboardData({
            stats: statsResult.data,
            recentOrders
          });

          setChartData({
            revenue: revenueData.success ? revenueData.data : [],
            orders: ordersData.success ? ordersData.data : []
          });
        } else {
          if (statsResult.error === 'rate_limit') {
            setError('Rate limit exceeded. Please wait a moment and refresh the page.');
          } else {
            setError('Failed to fetch dashboard data');
          }
        }
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
        if (err.message && err.message.includes('Too many requests')) {
          setError('Rate limit exceeded. Please wait a moment and refresh the page.');
        } else {
          setError('Failed to load dashboard data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <LoadingSpinner size="large" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard-error">
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'delivered': return '#047857';
      case 'out_for_delivery': return '#10b981';
      case 'preparing': return '#f59e0b';
      case 'confirmed': return '#3b82f6';
      case 'pending': return '#6b7280';
      case 'cancelled': return '#dc2626';
      case 'canceled': return '#dc2626';
      case 'failed': return '#dc2626';
      case 'rejected': return '#dc2626';
      case 'ready': return '#059669';
      case 'in_progress': return '#3b82f6';
      case 'processing': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Dashboard Overview</h1>
          <p>Real-time platform insights and performance metrics</p>
        </div>
        <div className="time-range-selector">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-select"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {}
      <div className="metrics-grid">
        <div className="metric-card revenue">
          <div className="metric-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
            </svg>
          </div>
          <div className="metric-content">
            <h3>Total Revenue</h3>
            <p className="metric-value">{formatCurrency(dashboardData.stats.totalRevenue)}</p>
            <span className={`metric-change ${dashboardData.stats.revenuePercentageChange >= 0 ? 'positive' : 'negative'}`}>
              {dashboardData.stats.revenuePercentageChange >= 0 ? '+' : ''}{dashboardData.stats.revenuePercentageChange.toFixed(1)}%
            </span>
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
            <p className="metric-value">{dashboardData.stats.totalOrders.toLocaleString()}</p>
            <span className={`metric-change ${dashboardData.stats.ordersPercentageChange >= 0 ? 'positive' : 'negative'}`}>
              {dashboardData.stats.ordersPercentageChange >= 0 ? '+' : ''}{dashboardData.stats.ordersPercentageChange.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="metric-card users">
          <div className="metric-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div className="metric-content">
            <h3>Active Orders</h3>
            <p className="metric-value">{dashboardData.stats.activeOrders.toLocaleString()}</p>
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
            <p className="metric-value">{dashboardData.stats.activeUsers.toLocaleString()}</p>
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
            <h3>Active Restaurants</h3>
            <p className="metric-value">{dashboardData.stats.activeRestaurants.toLocaleString()}</p>
            <span className="metric-change neutral">Live</span>
          </div>
        </div>

        <div className="metric-card avg-order">
          <div className="metric-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>
            </svg>
          </div>
          <div className="metric-content">
            <h3>Avg Order Value</h3>
            <p className="metric-value">{formatCurrency(dashboardData.stats.avgOrderValue || dashboardData.stats.averageOrderValue)}</p>
            <span className={`metric-change ${dashboardData.stats.avgOrderValuePercentageChange >= 0 ? 'positive' : 'negative'}`}>
              {dashboardData.stats.avgOrderValuePercentageChange >= 0 ? '+' : ''}{dashboardData.stats.avgOrderValuePercentageChange.toFixed(1)}%
            </span>
          </div>
        </div>

      </div>

      {}
      <div className="dashboard-content">
        <div className="chart-section">
          <Chart
            data={chartData.revenue}
            type="bar"
            title="Revenue Trend"
            subtitle="Quarterly revenue over time"
            valueKey="revenue"
            labelKey="quarter"
            tooltipContent={(item) => (
              <div>
                <div className="tooltip-title">{item.quarter}</div>
                <div className="tooltip-details">
                  <div className="tooltip-row">
                    <span className="label">Total Revenue:</span>
                    <span className="value">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.revenue)}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="label">Orders:</span>
                    <span className="value">{item.orders.toLocaleString()}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="label">Avg Order Value:</span>
                    <span className="value">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.avgOrderValue)}</span>
                  </div>
                </div>
              </div>
            )}
          />

          <Chart
            data={chartData.orders}
            type="bar"
            title="Weekly Orders"
            subtitle="Overall popularity by day of week"
            valueKey="orders"
            labelKey="day"
            tooltipContent={(item) => (
              <div>
                <div className="tooltip-title">{item.day}</div>
                <div className="tooltip-details">
                  <div className="tooltip-row">
                    <span className="label">Total Orders:</span>
                    <span className="value">{item.orders.toLocaleString()}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="label">Total Revenue:</span>
                    <span className="value">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.revenue)}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="label">Avg Order Value:</span>
                    <span className="value">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.avgOrderValue)}</span>
                  </div>
                </div>
              </div>
            )}
          />
        </div>

        <div className="recent-activity">
          <div className="activity-card">
            <div className="activity-header">
              <h3>Recent Orders</h3>
              <button className="view-all-btn" onClick={() => navigate('/admin/orders')}>View All</button>
            </div>
            <div className="activity-list">
              {dashboardData.recentOrders.map((order) => (
                <div key={order.id} className="activity-item">
                  <div className="activity-content">
                    <div className="activity-main">
                      <span className="order-id">{order.id}</span>
                      <span className="customer-name">{order.__display?.customer || order.customer}</span>
                    </div>
                    <div className="activity-details">
                      <span className="restaurant">{order.__display?.restaurant || order.restaurant || '—'}</span>
                      <span className="amount">{formatCurrency(order.__display?.amount ?? order.amount ?? 0)}</span>
                    </div>
                  </div>
                  <div className="activity-meta">
                    <span 
                      className="status" 
                      style={{ color: getStatusColor(order.status) }}
                    >
                      {(order.__display?.status || order.status || '').toString()}
                    </span>
                    <span className="time">{order.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 
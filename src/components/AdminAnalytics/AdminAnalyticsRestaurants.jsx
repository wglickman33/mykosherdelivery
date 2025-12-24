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
  fetchRestaurantMenuItems
} from '../../services/adminServices';

const AdminAnalyticsRestaurants = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restaurantSortBy, setRestaurantSortBy] = useState('revenue');
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [restaurantMenuItems, setRestaurantMenuItems] = useState([]);
  const [menuItemsLoading, setMenuItemsLoading] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const fetchRestaurantData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch comprehensive analytics for restaurant data
      const analyticsResult = await fetchComprehensiveAnalytics();
      if (analyticsResult.success) {
        setAnalyticsData(analyticsResult.data);
      }
    } catch (error) {
      console.error('Error fetching restaurant analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMenuItemsData = useCallback(async (restaurantId) => {
    if (!restaurantId) {
      setRestaurantMenuItems([]);
      return;
    }

    try {
      setMenuItemsLoading(true);
      const result = await fetchRestaurantMenuItems(restaurantId, '30d');
      if (result.success) {
        setRestaurantMenuItems(result.data);
      }
    } catch (error) {
      console.error('Error fetching restaurant menu items:', error);
    } finally {
      setMenuItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurantData();
  }, [fetchRestaurantData]);

  if (loading) {
    return (
      <div className="admin-analytics-loading">
        <LoadingSpinner />
        <p>Loading restaurant analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="admin-analytics-error">
        <p>Failed to load restaurant analytics. Please try again.</p>
      </div>
    );
  }

  // Sort restaurants based on selected criteria
  const sortedRestaurants = [...(analyticsData.topRestaurants || [])].sort((a, b) => {
    switch (restaurantSortBy) {
      case 'orders':
        return b.orders - a.orders;
      case 'avgOrderValue':
        return b.avgOrderValue - a.avgOrderValue;
      case 'revenue':
      default:
        return b.revenue - a.revenue;
    }
  });

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        {/* Restaurant Overview Cards */}
        <div className="metrics-grid">
          <div className="metric-card revenue">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41-5.51-5.51z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Total Restaurants</h3>
              <p className="metric-value">{analyticsData.overview.activeRestaurants.toLocaleString()}</p>
              <span className="metric-change neutral">Active</span>
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
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>

          <div className="metric-card users">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Average Revenue per Restaurant</h3>
              <p className="metric-value">{formatCurrency(analyticsData.overview.totalRevenue / Math.max(analyticsData.overview.activeRestaurants, 1))}</p>
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>

          <div className="metric-card restaurants">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Average Orders per Restaurant</h3>
              <span className="metric-value">{(analyticsData.overview.totalOrders / Math.max(analyticsData.overview.activeRestaurants, 1)).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Top Performing Restaurants */}
        <div className="top-restaurants-section">
          <div className="restaurants-header">
            <h3>Top Performing Restaurants</h3>
            <div className="restaurants-sort">
              <label htmlFor="restaurant-sort">Sort by:</label>
              <select 
                id="restaurant-sort"
                value={restaurantSortBy} 
                onChange={(e) => setRestaurantSortBy(e.target.value)}
                className="sort-selector"
              >
                <option value="revenue">Revenue</option>
                <option value="orders">Orders</option>
                <option value="avgOrderValue">Average Order Value</option>
              </select>
            </div>
          </div>
          
          <div className="restaurants-list">
            {sortedRestaurants.map((restaurant, index) => (
              <div key={restaurant.id} className="restaurant-item">
                <div className="restaurant-rank">
                  {index + 1}
                </div>
                <div className="restaurant-info">
                  <h4>{restaurant.name}</h4>
                  <div className="restaurant-stats">
                    <span>Revenue: {formatCurrency(restaurant.revenue)}</span>
                    <span>Orders: {restaurant.orders.toLocaleString()}</span>
                    <span>AOV: {formatCurrency(restaurant.avgOrderValue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Restaurant Performance Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Top 10 Restaurants by Revenue</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={analyticsData.topRestaurants.slice(0, 10).map(restaurant => ({
                ...restaurant,
                name: restaurant.name.length > 20 ? restaurant.name.substring(0, 20) + '...' : restaurant.name
              }))}
              valueKey="revenue"
              labelKey="name"
              chartColor="#3b82f6"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {analyticsData.topRestaurants.find(r => r.name.includes(item.name))?.name || item.name}
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

        {/* Restaurant Order Distribution Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Restaurant Order Distribution</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={analyticsData.topRestaurants.slice(0, 10).map(restaurant => ({
                ...restaurant,
                name: restaurant.name.length > 15 ? restaurant.name.substring(0, 15) + '...' : restaurant.name
              }))}
              valueKey="orders"
              labelKey="name"
              chartColor="#10b981"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {analyticsData.topRestaurants.find(r => r.name.includes(item.name))?.name || item.name}
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

        {/* Restaurant Average Order Value Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Restaurant Average Order Values</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={[...analyticsData.topRestaurants]
                .sort((a, b) => b.avgOrderValue - a.avgOrderValue)
                .slice(0, 10)
                .map(restaurant => ({
                  ...restaurant,
                  name: restaurant.name.length > 15 ? restaurant.name.substring(0, 15) + '...' : restaurant.name
                }))}
              valueKey="avgOrderValue"
              labelKey="name"
              chartColor="#f59e0b"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {analyticsData.topRestaurants.find(r => r.name.includes(item.name))?.name || item.name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Avg Order Value:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(item.avgOrderValue)}
                      </Typography>
                    </Box>
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
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>

        {/* Restaurant Menu Items Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Top Menu Items by Restaurant</h3>
            <div className="chart-controls">
              <select 
                value={selectedRestaurant} 
                onChange={(e) => {
                  setSelectedRestaurant(e.target.value);
                  fetchMenuItemsData(e.target.value);
                }}
                className="period-selector"
              >
                <option value="">Select a restaurant...</option>
                {analyticsData?.topRestaurants?.map(restaurant => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedRestaurant ? (
            <ThemeProvider theme={AdminAnalyticsTheme}>
              {menuItemsLoading ? (
                <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LoadingSpinner />
                  <p style={{ marginLeft: '16px' }}>Loading menu items...</p>
                </div>
              ) : restaurantMenuItems.length > 0 ? (
                <MaterialChart
                  data={restaurantMenuItems}
                  valueKey="quantity"
                  labelKey="name"
                  chartColor="#8b5cf6"
                  title=""
                  type="bar"
                  tooltipContent={(item) => (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {item.name}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Quantity Sold:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {item.quantity.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Price:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(item.price)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Total Revenue:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(item.revenue)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                />
              ) : (
                <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                  <Typography variant="h6" color="text.secondary">No menu items found for this restaurant</Typography>
                </div>
              )}
            </ThemeProvider>
          ) : (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px' }}>
              <Typography variant="h6" color="text.secondary">Please select a restaurant to view menu items</Typography>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsRestaurants;

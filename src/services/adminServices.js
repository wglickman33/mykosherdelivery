import apiClient from '../lib/api';
import logger from '../utils/logger';

// ===== DASHBOARD ANALYTICS =====

// Helper function to add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchDashboardStats = async (timeRange = '7d') => {
  try {
    // Calculate date range based on timeRange parameter
    const now = new Date();
    let startDate, previousStartDate;
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        previousStartDate = new Date(now.getTime() - (48 * 60 * 60 * 1000)); // Previous 24h
        break;
      case '7d':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        previousStartDate = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000)); // Previous 7d
        break;
      case '30d':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        previousStartDate = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)); // Previous 30d
        break;
      case '90d':
        startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        previousStartDate = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000)); // Previous 90d
        break;
      default:
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Default to 7 days
        previousStartDate = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
    }

    const currentDateFilter = { startDate: startDate.toISOString() };
    const previousDateFilter = { startDate: previousStartDate.toISOString(), endDate: startDate.toISOString() };

    // Debug logging
    console.log(`🔍 Fetching dashboard stats for ${timeRange}:`, {
      currentPeriod: {
        start: startDate.toISOString(),
        end: now.toISOString(),
        duration: `${Math.round((now - startDate) / (1000 * 60 * 60))} hours`
      },
      previousPeriod: {
        start: previousStartDate.toISOString(),
        end: startDate.toISOString(),
        duration: `${Math.round((startDate - previousStartDate) / (1000 * 60 * 60))} hours`
      }
    });

    // Fetch current period data - reduce API calls by getting all orders and filtering
    const currentOrdersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 1000, ...currentDateFilter });
    const currentOrders = currentOrdersResponse?.data || [];
    
    console.log(`📊 Current period orders (${timeRange}):`, {
      total: currentOrdersResponse?.pagination?.total || currentOrders.length,
      fetched: currentOrders.length,
      sampleDates: currentOrders.slice(0, 3).map(o => ({ 
        id: o.id, 
        createdAt: o.createdAt, 
        status: o.status 
      }))
    });
    
    const currentTotalOrders = currentOrdersResponse?.pagination?.total || currentOrders.length;
    const currentDeliveredOrders = currentOrders.filter(order => order.status === 'delivered').length;
    const currentCancelledOrders = currentOrders.filter(order => order.status === 'cancelled').length;
    
    // Active orders = not delivered or cancelled
    const currentActiveOrders = currentOrders.filter(order => 
      ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status)
    ).length;

    // Add small delay to prevent rate limiting
    await delay(100);

    // Fetch previous period data for comparison
    const previousOrdersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 1000, ...previousDateFilter });
    const previousOrders = previousOrdersResponse?.data || [];
    
    console.log(`📊 Previous period orders (${timeRange}):`, {
      total: previousOrdersResponse?.pagination?.total || previousOrders.length,
      fetched: previousOrders.length,
      sampleDates: previousOrders.slice(0, 3).map(o => ({ 
        id: o.id, 
        createdAt: o.createdAt, 
        status: o.status 
      }))
    });
    
    const previousTotalOrders = previousOrdersResponse?.pagination?.total || previousOrders.length;
    const previousActiveOrders = previousOrders.filter(order => 
      ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status)
    ).length;

    // Add small delay to prevent rate limiting
    await delay(100);

    // Users, Restaurants counts (these are total counts, not time-filtered)
    const [usersAny, restaurantsAny] = await Promise.all([
      apiClient.get('/admin/users', { page: 1, limit: 1 }),
      apiClient.get('/admin/restaurants', { page: 1, limit: 1 })
    ]);

    const totalUsers = usersAny?.pagination?.total || 0;
    const totalRestaurants = restaurantsAny?.pagination?.total || 0;

    // Revenue and AOV calculation using the orders we already fetched
    const currentAmounts = currentOrders.map(o => Number(o?.total || o?.amount || 0)).filter(n => Number.isFinite(n));
    const currentTotalRevenue = currentAmounts.reduce((a, b) => a + b, 0);
    const currentAverageOrderValue = currentAmounts.length ? currentTotalRevenue / currentAmounts.length : 0;

    const previousAmounts = previousOrders.map(o => Number(o?.total || o?.amount || 0)).filter(n => Number.isFinite(n));
    const previousTotalRevenue = previousAmounts.reduce((a, b) => a + b, 0);
    const previousAverageOrderValue = previousAmounts.length ? previousTotalRevenue / previousAmounts.length : 0;

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const ordersPercentageChange = calculatePercentageChange(currentTotalOrders, previousTotalOrders);
    const revenuePercentageChange = calculatePercentageChange(currentTotalRevenue, previousTotalRevenue);
    const activeOrdersPercentageChange = calculatePercentageChange(currentActiveOrders, previousActiveOrders);
    const avgOrderValuePercentageChange = calculatePercentageChange(currentAverageOrderValue, previousAverageOrderValue);

    return {
      success: true,
      data: {
        totalOrders: currentTotalOrders,
        activeOrders: currentActiveOrders,
        deliveredOrders: currentDeliveredOrders,
        cancelledOrders: currentCancelledOrders,
        totalRevenue: currentTotalRevenue,
        totalUsers,
        totalRestaurants,
        activeUsers: totalUsers,
        activeRestaurants: totalRestaurants,
        averageOrderValue: currentAverageOrderValue,
        avgOrderValue: currentAverageOrderValue,
        timeRange,
        // Percentage changes
        ordersPercentageChange,
        revenuePercentageChange,
        activeOrdersPercentageChange,
        avgOrderValuePercentageChange,
        // Previous period data for reference
        previousPeriod: {
          totalOrders: previousTotalOrders,
          activeOrders: previousActiveOrders,
          totalRevenue: previousTotalRevenue,
          averageOrderValue: previousAverageOrderValue
        }
      }
    };
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    
    // If it's a rate limiting error, return a more informative response
    if (error.message.includes('Too many requests')) {
      return { 
        success: false, 
        error: 'rate_limit',
        message: 'Rate limit exceeded. Please wait a moment and try again.',
        data: {
          totalOrders: 0,
          activeOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          totalRevenue: 0,
          totalUsers: 0,
          totalRestaurants: 0,
          activeUsers: 0,
          activeRestaurants: 0,
          averageOrderValue: 0,
          avgOrderValue: 0,
          timeRange,
          // Set percentage changes to 0 for rate limit errors
          ordersPercentageChange: 0,
          revenuePercentageChange: 0,
          activeOrdersPercentageChange: 0,
          avgOrderValuePercentageChange: 0
        }
      };
    }
    
    return { 
      success: false, 
      error: 'fetch_error',
      message: 'Failed to fetch dashboard data. Please try again.',
      data: {
        totalOrders: 0,
        activeOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        totalUsers: 0,
        totalRestaurants: 0,
        activeUsers: 0,
        activeRestaurants: 0,
        averageOrderValue: 0,
        avgOrderValue: 0,
        timeRange,
        ordersPercentageChange: 0,
        revenuePercentageChange: 0,
        activeOrdersPercentageChange: 0,
        avgOrderValuePercentageChange: 0
      }
    };
  }
};

// Fetch quarterly revenue data for charts
export const fetchQuarterlyRevenueData = async () => {
  try {
    const now = new Date();
    const quarters = [];
    
    // Get data for the last 4 quarters
    for (let i = 3; i >= 0; i--) {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - (i * 3), 1);
      const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
      
      const quarterData = await apiClient.get('/admin/orders', {
        page: 1,
        limit: 1000,
        startDate: quarterStart.toISOString(),
        endDate: quarterEnd.toISOString()
      });
      
      const orders = quarterData?.data || [];
      const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
      
      quarters.push({
        quarter: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`,
        period: `${quarterStart.toISOString().substring(0, 7)} - ${quarterEnd.toISOString().substring(0, 7)}`,
        revenue: totalRevenue,
        orders: orders.length,
        avgOrderValue: avgOrderValue
      });
    }
    
    return { success: true, data: quarters };
  } catch (error) {
    logger.error('Error fetching quarterly revenue data:', error);
    return { success: false, data: [] };
  }
};

// Fetch weekly orders data for charts - aggregate by day of week across all time
export const fetchWeeklyOrdersData = async () => {
  try {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayTotals = Array(7).fill(0).map((_, index) => ({
      day: dayNames[index],
      orders: 0,
      revenue: 0,
      avgOrderValue: 0
    }));
    
    // Get ALL orders (no date filter) to aggregate by day of week
    const allOrdersResponse = await apiClient.get('/admin/orders', {
      page: 1,
      limit: 10000 // Large limit to get all orders
    });
    
    const allOrders = allOrdersResponse?.data || [];
    
    // Aggregate orders by day of week
    allOrders.forEach(order => {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const dayOfWeek = orderDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        dayTotals[dayOfWeek].orders += 1;
        dayTotals[dayOfWeek].revenue += Number(order.total) || 0;
      }
    });
    
    // Calculate average order values
    dayTotals.forEach(day => {
      day.avgOrderValue = day.orders > 0 ? day.revenue / day.orders : 0;
    });
    
    console.log('📊 Weekly Orders Aggregation:', dayTotals);
    
    return { success: true, data: dayTotals };
  } catch (error) {
    logger.error('Error fetching weekly orders data:', error);
    return { success: false, data: [] };
  }
};

export const fetchRecentOrders = async (limit = 10, timeRange = '7d') => {
  try {
    // Calculate date range based on timeRange parameter
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case '7d':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '30d':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '90d':
        startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      default:
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Default to 7 days
    }

    const dateFilter = { startDate: startDate.toISOString() };
    const response = await apiClient.get('/admin/orders/recent', { limit, ...dateFilter });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error fetching recent orders:', error);
    return { success: false, error: error.message };
  }
};

// ===== ORDERS MANAGEMENT =====

export const fetchAllOrders = async (filters = {}) => {
  try {
    const response = await apiClient.get('/admin/orders', filters);
    return { success: true, data: response.data, pagination: response.pagination };
  } catch (error) {
    logger.error('Error fetching orders:', error);
    return { success: false, error: error.message };
  }
};

export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const response = await apiClient.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating order status:', error);
    return { success: false, error: error.message };
  }
};

export const fetchOrderById = async (orderId) => {
  try {
    const response = await apiClient.get(`/admin/orders/${orderId}`);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error fetching order:', error);
    return { success: false, error: error.message };
  }
};

export const updateOrder = async (orderId, orderData) => {
  try {
    const response = await apiClient.put(`/admin/orders/${orderId}`, orderData);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating order:', error);
    return { success: false, error: error.message };
  }
};

export const deleteOrder = async (orderId) => {
  try {
    const response = await apiClient.delete(`/admin/orders/${orderId}`);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error deleting order:', error);
    return { success: false, error: error.message };
  }
};

export const processRefund = async (orderId, refundData) => {
  try {
    const response = await apiClient.post(`/admin/orders/${orderId}/refund`, refundData);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error processing refund:', error);
    return { success: false, error: error.message || 'Failed to process refund' };
  }
};

export const fetchOrderRefunds = async (orderId) => {
  try {
    const response = await apiClient.get(`/admin/orders/${orderId}/refunds`);
    return { success: true, data: response.data || [] };
  } catch (error) {
    logger.error('Error fetching refunds:', error);
    return { success: false, error: error.message || 'Failed to fetch refunds' };
  }
};

// ===== USERS MANAGEMENT =====

export const fetchAllUsers = async (filters = {}) => {
  try {
    const response = await apiClient.get('/admin/users', filters);
    return { success: true, data: response.data, pagination: response.pagination };
  } catch (error) {
    logger.error('Error fetching users:', error);
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (userId, userData) => {
  try {
    const response = await apiClient.put(`/admin/users/${userId}`, userData);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error updating user profile:', error);
    return { success: false, error: error.message };
  }
};

export const updateUserRole = async (userId, newRole) => {
  try {
    const response = await apiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating user role:', error);
    return { success: false, error: error.message };
  }
};

export const suspendUser = async (userId, reason) => {
  try {
    const response = await apiClient.patch(`/admin/users/${userId}/suspend`, { reason });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error suspending user:', error);
    return { success: false, error: error.message };
  }
};

export const unsuspendUser = async (userId) => {
  try {
    const response = await apiClient.patch(`/admin/users/${userId}/unsuspend`);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error unsuspending user:', error);
    return { success: false, error: error.message };
  }
};

export const createUser = async (userData) => {
  try {
    logger.info('Creating user with data:', userData);
    const response = await apiClient.post('/admin/users', userData);
    logger.info('User created successfully:', response);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error creating user:', error);
    logger.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response
    });
    return { success: false, error: error.message };
  }
};

export const deleteUser = async (userId) => {
  try {
    await apiClient.delete(`/admin/users/${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error deleting user:', error);
    return { success: false, error: error.message };
  }
};

// ===== RESTAURANTS MANAGEMENT =====

export const fetchAllRestaurants = async (filters = {}) => {
  try {
    const response = await apiClient.get('/admin/restaurants', filters);
    return { success: true, data: response.data, pagination: response.pagination };
  } catch (error) {
    logger.error('Error fetching restaurants:', error);
    return { success: false, error: error.message };
  }
};

export const fetchRestaurantMenu = async (restaurantId, filters = {}) => {
  try {
    const response = await apiClient.get(`/admin/restaurants/${restaurantId}/menu`, filters);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error fetching restaurant menu:', error);
    return { success: false, error: error.message };
  }
};

export const fetchAllMenuItems = async (filters = {}) => {
  try {
    const response = await apiClient.get('/admin/menu-items', filters);
    return { success: true, data: response.data, pagination: response.pagination };
  } catch (error) {
    logger.error('Error fetching menu items:', error);
    return { success: false, error: error.message };
  }
};

export const updateRestaurant = async (restaurantId, updates) => {
  try {
    const response = await apiClient.put(`/admin/restaurants/${restaurantId}`, updates);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating restaurant:', error);
    return { success: false, error: error.message };
  }
};

export const toggleRestaurantFeatured = async (restaurantId) => {
  try {
    const response = await apiClient.patch(`/admin/restaurants/${restaurantId}/featured`);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error toggling restaurant featured status:', error);
    return { success: false, error: error.message };
  }
};

export const addRestaurant = async (restaurantData) => {
  try {
    const response = await apiClient.post('/admin/restaurants', restaurantData);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error adding restaurant:', error);
    return { success: false, error: error.message };
  }
};

export const deleteRestaurant = async (restaurantId) => {
  try {
    await apiClient.delete(`/admin/restaurants/${restaurantId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error deleting restaurant:', error);
    return { success: false, error: error.message };
  }
};

// ===== MENU MANAGEMENT =====

export const fetchMenuChangeRequests = async (filters = {}) => {
  try {
    const response = await apiClient.get('/admin/menu-requests', filters);
    return { success: true, data: response.data, pagination: response.pagination };
  } catch (error) {
    logger.error('Error fetching menu change requests:', error);
    return { success: false, error: error.message };
  }
};

export const approveMenuChange = async (requestId, adminNotes = '') => {
  try {
    const response = await apiClient.patch(`/admin/menu-requests/${requestId}/approve`, { adminNotes });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error approving menu change:', error);
    return { success: false, error: error.message };
  }
};

export const rejectMenuChange = async (requestId, adminNotes = '') => {
  try {
    const response = await apiClient.patch(`/admin/menu-requests/${requestId}/reject`, { adminNotes });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error rejecting menu change:', error);
    return { success: false, error: error.message };
  }
};

// ===== ANALYTICS =====

export const fetchOrdersAnalytics = async (timeRange = '30d') => {
  try {
    const response = await apiClient.get('/admin/analytics/orders', { timeRange });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error fetching orders analytics:', error);
    return { success: false, error: error.message };
  }
};

export const fetchRevenueAnalytics = async (timeRange = '30d') => {
  try {
    const response = await apiClient.get('/admin/analytics/revenue', { timeRange });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error fetching revenue analytics:', error);
    return { success: false, error: error.message };
  }
};

export const fetchUserAnalytics = async (timeRange = '30d') => {
  try {
    const response = await apiClient.get('/admin/analytics/users', { timeRange });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error fetching user analytics:', error);
    return { success: false, error: error.message };
  }
};

export const fetchRestaurantAnalytics = async (timeRange = '30d') => {
  try {
    const response = await apiClient.get('/admin/analytics/restaurants', { timeRange });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error fetching restaurant analytics:', error);
    return { success: false, error: error.message };
  }
};

// ===== COMPREHENSIVE ANALYTICS =====

// Get comprehensive analytics overview
export const fetchComprehensiveAnalytics = async (timeRange = '30d') => {
  try {
    // Get all orders for the time period
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Get users and restaurants with pagination info
    const [usersResponse, restaurantsResponse] = await Promise.all([
      apiClient.get('/admin/users', { page: 1, limit: 1 }),
      apiClient.get('/admin/restaurants', { page: 1, limit: 10000 })
    ]);
    
    const restaurants = restaurantsResponse?.data || [];

    // Calculate overview metrics
    const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const activeUsers = usersResponse?.pagination?.total || 0; // Use total from pagination like dashboard
    const activeRestaurants = restaurants.filter(restaurant => restaurant.active !== false).length;

    // Calculate order status breakdown
    const statusBreakdown = orders.reduce((acc, order) => {
      const status = order.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Calculate top performing restaurants based on items within orders
    // Since orders can contain items from multiple restaurants, we need to track:
    // 1. Revenue per restaurant (sum of item prices before tax)
    // 2. Order count per restaurant (count of orders that contain items from that restaurant)
    
    const restaurantStats = restaurants.map(restaurant => {
      let revenue = 0;
      const ordersWithThisRestaurant = new Set(); // Track unique orders that include this restaurant
      
      // Go through all orders and find items from this restaurant
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          let hasItemsFromThisRestaurant = false;
          
          order.items.forEach(item => {
            // Check if this item belongs to the current restaurant
            if (item.restaurantId === restaurant.id || item.restaurant?.id === restaurant.id) {
              // Add item revenue (before tax)
              const itemRevenue = (Number(item.price) || 0) * (Number(item.quantity) || 1);
              revenue += itemRevenue;
              hasItemsFromThisRestaurant = true;
            }
          });
          
          // If this order contains items from this restaurant, count it as an order
          if (hasItemsFromThisRestaurant) {
            ordersWithThisRestaurant.add(order.id);
          }
        }
      });
      
      const orderCount = ordersWithThisRestaurant.size;
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        orders: orderCount,
        revenue: revenue,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Calculate user retention (users with 2+ orders)
    const userOrderCounts = orders.reduce((acc, order) => {
      if (order.userId) {
        acc[order.userId] = (acc[order.userId] || 0) + 1;
      }
      return acc;
    }, {});
    const usersWithMultipleOrders = Object.values(userOrderCounts).filter(count => count >= 2).length;
    const retentionRate = activeUsers > 0 ? (usersWithMultipleOrders / activeUsers) * 100 : 0;

    return {
      success: true,
      data: {
        overview: {
          totalRevenue,
          totalOrders,
          avgOrderValue,
          activeUsers,
          activeRestaurants,
          retentionRate
        },
        orderStatusBreakdown: statusBreakdown,
        topRestaurants: restaurantStats,
        userRetention: {
          totalUsers: activeUsers,
          usersWithMultipleOrders,
          retentionRate
        }
      }
    };
  } catch (error) {
    logger.error('Error fetching comprehensive analytics:', error);
    return { success: false, error: error.message };
  }
};

// Get revenue trends by different time periods
export const fetchRevenueTrends = async (period = 'quarterly') => {
  try {
    const now = new Date();
    let periods = [];

    switch (period) {
      case 'weekly':
        // Last 12 weeks - proper week boundaries (Monday to Sunday)
        for (let i = 11; i >= 0; i--) {
          const weekStart = new Date(now);
          // Get Monday of the week
          const dayOfWeek = weekStart.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, so go back 6 days to get Monday
          weekStart.setDate(weekStart.getDate() + mondayOffset - (i * 7));
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          const weekData = await apiClient.get('/admin/orders', {
            page: 1,
            limit: 1000,
            startDate: weekStart.toISOString(),
            endDate: weekEnd.toISOString()
          });
          
          const orders = weekData?.data || [];
          const revenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
          
          periods.push({
            period: `Week ${12 - i}`,
            label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            revenue,
            orders: orders.length,
            avgOrderValue: orders.length > 0 ? revenue / orders.length : 0
          });
        }
        break;

      case 'monthly':
        // Last 12 months - proper month boundaries
        for (let i = 11; i >= 0; i--) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthStart.setHours(0, 0, 0, 0);
          
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          const monthData = await apiClient.get('/admin/orders', {
            page: 1,
            limit: 1000,
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString()
          });
          
          const orders = monthData?.data || [];
          const revenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
          
          periods.push({
            period: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            revenue,
            orders: orders.length,
            avgOrderValue: orders.length > 0 ? revenue / orders.length : 0
          });
        }
        break;

      case 'quarterly':
        // Last 4 quarters - proper quarter boundaries
        for (let i = 3; i >= 0; i--) {
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - (i * 3), 1);
          quarterStart.setHours(0, 0, 0, 0);
          
          const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
          quarterEnd.setHours(23, 59, 59, 999);
          
          const quarterData = await apiClient.get('/admin/orders', {
            page: 1,
            limit: 1000,
            startDate: quarterStart.toISOString(),
            endDate: quarterEnd.toISOString()
          });
          
          const orders = quarterData?.data || [];
          const revenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
          
          periods.push({
            period: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`,
            label: `${quarterStart.toLocaleDateString('en-US', { month: 'short' })} - ${quarterEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
            revenue,
            orders: orders.length,
            avgOrderValue: orders.length > 0 ? revenue / orders.length : 0
          });
        }
        break;
    }

    return { success: true, data: periods };
  } catch (error) {
    logger.error('Error fetching revenue trends:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to get date filter based on time range
const getDateFilter = (timeRange) => {
  const now = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case '24h':
      startDate.setHours(now.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: now.toISOString()
  };
};

// Fetch revenue breakdown by restaurant
export const fetchRevenueByRestaurant = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Get all restaurants
    const restaurantsResponse = await apiClient.get('/admin/restaurants', { page: 1, limit: 10000 });
    const restaurants = restaurantsResponse?.data || [];

    // Calculate revenue by restaurant
    const restaurantRevenue = restaurants.map(restaurant => {
      let revenue = 0;
      let orderCount = 0;
      
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          let hasItemsFromThisRestaurant = false;
          
          order.items.forEach(item => {
            if (item.restaurantId === restaurant.id || item.restaurant?.id === restaurant.id) {
              revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
              hasItemsFromThisRestaurant = true;
            }
          });
          
          if (hasItemsFromThisRestaurant) {
            orderCount++;
          }
        }
      });
      
      return {
        restaurant: restaurant.name,
        revenue: revenue,
        orderCount: orderCount,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    return { success: true, data: restaurantRevenue };
  } catch (error) {
    logger.error('Error fetching revenue by restaurant:', error);
    return { success: false, data: [] };
  }
};

// Fetch revenue by time of day
export const fetchRevenueByTimeOfDay = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Helper function to format time in 12-hour format
    const formatTime = (hour) => {
      if (hour === 0) return '12:00 AM';
      if (hour < 12) return `${hour}:00 AM`;
      if (hour === 12) return '12:00 PM';
      return `${hour - 12}:00 PM`;
    };

    // Initialize 24-hour buckets
    const hourlyRevenue = Array(24).fill(0).map((_, hour) => ({
      hour: hour,
      time: formatTime(hour),
      period: hour < 6 ? 'Late Night' : 
              hour < 12 ? 'Morning' : 
              hour < 17 ? 'Afternoon' : 
              hour < 21 ? 'Evening' : 'Night',
      revenue: 0,
      orders: 0
    }));

    // Aggregate revenue by hour
    orders.forEach(order => {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const hour = orderDate.getHours();
        const revenue = Number(order.total) || 0;
        
        hourlyRevenue[hour].revenue += revenue;
        hourlyRevenue[hour].orders += 1;
      }
    });

    // Calculate average order value
    hourlyRevenue.forEach(hour => {
      hour.avgOrderValue = hour.orders > 0 ? hour.revenue / hour.orders : 0;
    });

    return { success: true, data: hourlyRevenue };
  } catch (error) {
    logger.error('Error fetching revenue by time of day:', error);
    return { success: false, data: [] };
  }
};

// Fetch top revenue users
export const fetchTopRevenueUsers = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Get all users
    const usersResponse = await apiClient.get('/admin/users', { page: 1, limit: 10000 });
    const users = usersResponse?.data || [];

    // Calculate revenue by user
    const userRevenue = {};
    
    orders.forEach(order => {
      if (order.userId && order.total) {
        const userId = order.userId;
        const revenue = Number(order.total) || 0;
        
        if (!userRevenue[userId]) {
          userRevenue[userId] = {
            userId: userId,
            revenue: 0,
            orderCount: 0
          };
        }
        
        userRevenue[userId].revenue += revenue;
        userRevenue[userId].orderCount += 1;
      }
    });

    // Convert to array and add user info
    const topUsers = Object.values(userRevenue)
      .map(user => {
        const userInfo = users.find(u => u.id === user.userId);
        return {
          user: userInfo ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || userInfo.email : `User ${user.userId}`,
          revenue: user.revenue,
          orderCount: user.orderCount,
          avgOrderValue: user.orderCount > 0 ? user.revenue / user.orderCount : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return { success: true, data: topUsers };
  } catch (error) {
    logger.error('Error fetching top revenue users:', error);
    return { success: false, data: [] };
  }
};

// Fetch revenue by day of week
export const fetchRevenueByDayOfWeek = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyRevenue = dayNames.map((dayName, dayIndex) => ({
      day: dayName,
      dayIndex: dayIndex,
      revenue: 0,
      orders: 0,
      avgOrderValue: 0
    }));

    // Aggregate revenue by day of week
    orders.forEach(order => {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const dayOfWeek = orderDate.getDay();
        const revenue = Number(order.total) || 0;
        
        dailyRevenue[dayOfWeek].revenue += revenue;
        dailyRevenue[dayOfWeek].orders += 1;
      }
    });

    // Calculate average order value
    dailyRevenue.forEach(day => {
      day.avgOrderValue = day.orders > 0 ? day.revenue / day.orders : 0;
    });

    return { success: true, data: dailyRevenue };
  } catch (error) {
    logger.error('Error fetching revenue by day of week:', error);
    return { success: false, data: [] };
  }
};

// ===== ORDER ANALYTICS FUNCTIONS =====

// Fetch order volume trends by period
export const fetchOrderVolumeTrends = async (period = 'quarterly') => {
  try {
    const now = new Date();
    let periods = [];

    switch (period) {
      case 'weekly':
        // Last 12 weeks
        for (let i = 11; i >= 0; i--) {
          const weekStart = new Date(now);
          const dayOfWeek = weekStart.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          weekStart.setDate(weekStart.getDate() + mondayOffset - (i * 7));
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          const weekData = await apiClient.get('/admin/orders', {
            page: 1,
            limit: 1000,
            startDate: weekStart.toISOString(),
            endDate: weekEnd.toISOString()
          });
          
          const orders = weekData?.data || [];
          const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
          
          periods.push({
            period: `Week ${12 - i}`,
            label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            orders: orders.length,
            revenue: totalRevenue,
            avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
          });
        }
        break;

      case 'monthly':
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthStart.setHours(0, 0, 0, 0);
          
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          const monthData = await apiClient.get('/admin/orders', {
            page: 1,
            limit: 1000,
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString()
          });
          
          const orders = monthData?.data || [];
          const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
          
          periods.push({
            period: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            orders: orders.length,
            revenue: totalRevenue,
            avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
          });
        }
        break;

      case 'quarterly':
        // Last 4 quarters
        for (let i = 3; i >= 0; i--) {
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - (i * 3), 1);
          quarterStart.setHours(0, 0, 0, 0);
          
          const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
          quarterEnd.setHours(23, 59, 59, 999);
          
          const quarterData = await apiClient.get('/admin/orders', {
            page: 1,
            limit: 1000,
            startDate: quarterStart.toISOString(),
            endDate: quarterEnd.toISOString()
          });
          
          const orders = quarterData?.data || [];
          const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
          
          periods.push({
            period: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`,
            label: `${quarterStart.toLocaleDateString('en-US', { month: 'short' })} - ${quarterEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
            orders: orders.length,
            revenue: totalRevenue,
            avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
          });
        }
        break;
    }

    return { success: true, data: periods };
  } catch (error) {
    logger.error('Error fetching order volume trends:', error);
    return { success: false, data: [] };
  }
};

// Fetch order size distribution
export const fetchOrderSizeDistribution = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Define order size buckets
    const sizeBuckets = [
      { range: '$0-100', min: 0, max: 100, count: 0, orders: [] },
      { range: '$100-200', min: 100, max: 200, count: 0, orders: [] },
      { range: '$200-300', min: 200, max: 300, count: 0, orders: [] },
      { range: '$300-400', min: 300, max: 400, count: 0, orders: [] },
      { range: '$400-500', min: 400, max: 500, count: 0, orders: [] },
      { range: '$500+', min: 500, max: Infinity, count: 0, orders: [] }
    ];

    // Categorize orders into buckets
    orders.forEach(order => {
      const orderValue = Number(order.total) || 0;
      for (const bucket of sizeBuckets) {
        if (orderValue >= bucket.min && orderValue < bucket.max) {
          bucket.count++;
          bucket.orders.push(order);
          break;
        }
      }
    });

    // Calculate percentages and average values
    const totalOrders = orders.length;
    const distribution = sizeBuckets.map(bucket => ({
      range: bucket.range,
      count: bucket.count,
      percentage: totalOrders > 0 ? ((bucket.count / totalOrders) * 100).toFixed(1) : 0,
      avgOrderValue: bucket.count > 0 ? bucket.orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0) / bucket.count : 0
    }));

    return { success: true, data: distribution };
  } catch (error) {
    logger.error('Error fetching order size distribution:', error);
    return { success: false, data: [] };
  }
};

// Fetch orders by day of week
export const fetchOrdersByDayOfWeek = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyOrders = dayNames.map((dayName, dayIndex) => ({
      day: dayName,
      dayIndex: dayIndex,
      orders: 0,
      revenue: 0,
      avgOrderValue: 0
    }));

    // Aggregate orders by day of week
    orders.forEach(order => {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const dayOfWeek = orderDate.getDay();
        const revenue = Number(order.total) || 0;
        
        dailyOrders[dayOfWeek].orders += 1;
        dailyOrders[dayOfWeek].revenue += revenue;
      }
    });

    // Calculate average order value
    dailyOrders.forEach(day => {
      day.avgOrderValue = day.orders > 0 ? day.revenue / day.orders : 0;
    });

    return { success: true, data: dailyOrders };
  } catch (error) {
    logger.error('Error fetching orders by day of week:', error);
    return { success: false, data: [] };
  }
};

// Fetch multi-restaurant vs single restaurant orders
export const fetchOrderTypeDistribution = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    let singleRestaurantCount = 0;
    let multiRestaurantCount = 0;

    orders.forEach(order => {
      // Check if order has multiple restaurants
      if (order.restaurantGroups && Object.keys(order.restaurantGroups).length > 1) {
        multiRestaurantCount++;
      } else if (order.items && Array.isArray(order.items)) {
        // Check if items are from multiple restaurants
        const restaurantIds = new Set();
        order.items.forEach(item => {
          if (item.restaurantId) {
            restaurantIds.add(item.restaurantId);
          }
        });
        if (restaurantIds.size > 1) {
          multiRestaurantCount++;
        } else {
          singleRestaurantCount++;
        }
      } else {
        // Default to single restaurant if no restaurant groups or items
        singleRestaurantCount++;
      }
    });

    const totalOrders = orders.length;
    const distribution = [
      {
        type: 'Single Restaurant',
        count: singleRestaurantCount,
        percentage: totalOrders > 0 ? ((singleRestaurantCount / totalOrders) * 100).toFixed(1) : 0
      },
      {
        type: 'Multi-Restaurant',
        count: multiRestaurantCount,
        percentage: totalOrders > 0 ? ((multiRestaurantCount / totalOrders) * 100).toFixed(1) : 0
      }
    ];

    console.log('Order Type Distribution Debug:', {
      totalOrders,
      singleRestaurantCount,
      multiRestaurantCount,
      distribution,
      sampleOrders: orders.slice(0, 3).map(order => ({
        id: order.id,
        hasRestaurantGroups: !!order.restaurantGroups,
        restaurantGroupsKeys: order.restaurantGroups ? Object.keys(order.restaurantGroups) : [],
        hasItems: !!order.items,
        itemsCount: order.items ? order.items.length : 0,
        itemRestaurantIds: order.items ? [...new Set(order.items.map(item => item.restaurantId).filter(Boolean))] : []
      }))
    });

    return { success: true, data: distribution };
  } catch (error) {
    logger.error('Error fetching order type distribution:', error);
    return { success: false, data: [] };
  }
};

// Fetch top ordering users
export const fetchTopOrderingUsers = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Get all users
    const usersResponse = await apiClient.get('/admin/users', { page: 1, limit: 10000 });
    const users = usersResponse?.data || [];

    // Calculate orders by user
    const userOrderCounts = {};
    
    orders.forEach(order => {
      if (order.userId) {
        const userId = order.userId;
        
        if (!userOrderCounts[userId]) {
          userOrderCounts[userId] = {
            userId: userId,
            orderCount: 0,
            totalSpent: 0
          };
        }
        
        userOrderCounts[userId].orderCount += 1;
        userOrderCounts[userId].totalSpent += Number(order.total) || 0;
      }
    });

    // Convert to array and add user info
    const topUsers = Object.values(userOrderCounts)
      .map(user => {
        const userInfo = users.find(u => u.id === user.userId);
        return {
          user: userInfo ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || userInfo.email : `User ${user.userId}`,
          orderCount: user.orderCount,
          totalSpent: user.totalSpent,
          avgOrderValue: user.orderCount > 0 ? user.totalSpent / user.orderCount : 0
        };
      })
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);

    return { success: true, data: topUsers };
  } catch (error) {
    logger.error('Error fetching top ordering users:', error);
    return { success: false, data: [] };
  }
};

// Fetch orders by time of day and day of week combined
export const fetchOrdersByTimeAndDay = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Helper function to format time in 12-hour format
    const formatTime = (hour) => {
      if (hour === 0) return '12:00 AM';
      if (hour < 12) return `${hour}:00 AM`;
      if (hour === 12) return '12:00 PM';
      return `${hour - 12}:00 PM`;
    };

    // Create combined data structure
    const combinedData = [];
    
    // For each day of week, create time slots
    dayNames.forEach((dayName, dayIndex) => {
      for (let hour = 0; hour < 24; hour++) {
        combinedData.push({
          day: dayName,
          dayIndex: dayIndex,
          hour: hour,
          time: formatTime(hour),
          orders: 0,
          revenue: 0,
          period: hour < 6 ? 'Late Night' : 
                  hour < 12 ? 'Morning' : 
                  hour < 17 ? 'Afternoon' : 
                  hour < 21 ? 'Evening' : 'Night'
        });
      }
    });

    // Aggregate orders by day and time
    orders.forEach(order => {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const dayOfWeek = orderDate.getDay();
        const hour = orderDate.getHours();
        const revenue = Number(order.total) || 0;
        
        // Find the corresponding data point
        const dataPoint = combinedData.find(d => d.dayIndex === dayOfWeek && d.hour === hour);
        if (dataPoint) {
          dataPoint.orders += 1;
          dataPoint.revenue += revenue;
        }
      }
    });

    // Calculate average order value
    combinedData.forEach(point => {
      point.avgOrderValue = point.orders > 0 ? point.revenue / point.orders : 0;
    });

    return { success: true, data: combinedData };
  } catch (error) {
    logger.error('Error fetching orders by time and day:', error);
    return { success: false, data: [] };
  }
};

// ===== USER ANALYTICS FUNCTIONS =====

// Fetch user overview metrics (all time)
export const fetchUserOverviewMetrics = async () => {
  try {
    // Get all users
    const usersResponse = await apiClient.get('/admin/users', { page: 1, limit: 10000 });
    const users = usersResponse?.data || [];

    // Get all orders
    const ordersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 10000 });
    const orders = ordersResponse?.data || [];

    // Calculate metrics
    const totalUsers = users.length;
    
    // Active users = users who have logged in at least once (have last_login)
    const activeUsers = users.filter(user => user.last_login).length;
    
    // New users = users who signed up but haven't necessarily logged in
    const newUsers = users.filter(user => {
      const signupDate = new Date(user.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return signupDate >= thirtyDaysAgo;
    }).length;

    // Calculate user order counts
    const userOrderCounts = {};
    orders.forEach(order => {
      if (order.userId) {
        userOrderCounts[order.userId] = (userOrderCounts[order.userId] || 0) + 1;
      }
    });

    // Retained users = users with 2+ orders
    const retainedUsers = Object.values(userOrderCounts).filter(count => count >= 2).length;
    
    // Retention rate = retained users / total users
    const retentionRate = totalUsers > 0 ? (retainedUsers / totalUsers) * 100 : 0;
    
    // Average orders per user
    const totalOrders = orders.length;
    const avgOrdersPerUser = totalUsers > 0 ? totalOrders / totalUsers : 0;

    return {
      success: true,
      data: {
        totalUsers,
        activeUsers,
        newUsers,
        retainedUsers,
        retentionRate: parseFloat(retentionRate.toFixed(1)),
        avgOrdersPerUser: parseFloat(avgOrdersPerUser.toFixed(1))
      }
    };
  } catch (error) {
    logger.error('Error fetching user overview metrics:', error);
    return { success: false, data: {} };
  }
};

// Fetch user registration trends
export const fetchUserRegistrationTrends = async (period = 'monthly') => {
  try {
    const usersResponse = await apiClient.get('/admin/users', { page: 1, limit: 10000 });
    const users = usersResponse?.data || [];

    const now = new Date();
    let periods = [];

    switch (period) {
      case 'weekly': {
        // Last 12 weeks - but include all users from the earliest signup
        const earliestSignup = users.length > 0 ? new Date(Math.min(...users.map(u => new Date(u.created_at)))) : now;
        const weeksBack = Math.max(12, Math.ceil((now - earliestSignup) / (7 * 24 * 60 * 60 * 1000)) + 1);
        
        for (let i = weeksBack - 1; i >= 0; i--) {
          const weekStart = new Date(now);
          const dayOfWeek = weekStart.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          weekStart.setDate(weekStart.getDate() + mondayOffset - (i * 7));
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          const weekUsers = users.filter(user => {
            const signupDate = new Date(user.created_at);
            return signupDate >= weekStart && signupDate <= weekEnd;
          });
          
          periods.push({
            period: `Week ${weeksBack - i}`,
            label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            users: weekUsers.length
          });
        }
        break;
      }

      case 'monthly': {
        // Last 12 months - but include all users from the earliest signup
        const earliestSignupMonthly = users.length > 0 ? new Date(Math.min(...users.map(u => new Date(u.created_at)))) : now;
        const monthsBack = Math.max(12, (now.getFullYear() - earliestSignupMonthly.getFullYear()) * 12 + (now.getMonth() - earliestSignupMonthly.getMonth()) + 1);
        
        for (let i = monthsBack - 1; i >= 0; i--) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthStart.setHours(0, 0, 0, 0);
          
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          const monthUsers = users.filter(user => {
            const signupDate = new Date(user.created_at);
            return signupDate >= monthStart && signupDate <= monthEnd;
          });
          
          periods.push({
            period: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            users: monthUsers.length
          });
        }
        break;
      }

      case 'quarterly': {
        // Last 4 quarters - but include all users from the earliest signup
        const earliestSignupQuarterly = users.length > 0 ? new Date(Math.min(...users.map(u => new Date(u.created_at)))) : now;
        const yearDiff = now.getFullYear() - earliestSignupQuarterly.getFullYear();
        const quarterDiff = Math.floor(now.getMonth() / 3) - Math.floor(earliestSignupQuarterly.getMonth() / 3);
        const totalQuarters = (yearDiff * 4) + quarterDiff + 1;
        const quartersBack = Math.max(4, Math.ceil(totalQuarters));
        
        for (let i = quartersBack - 1; i >= 0; i--) {
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - (i * 3), 1);
          quarterStart.setHours(0, 0, 0, 0);
          
          const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
          quarterEnd.setHours(23, 59, 59, 999);
          
          const quarterUsers = users.filter(user => {
            const signupDate = new Date(user.created_at);
            return signupDate >= quarterStart && signupDate <= quarterEnd;
          });
          
          periods.push({
            period: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`,
            label: `${quarterStart.toLocaleDateString('en-US', { month: 'short' })} - ${quarterEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
            users: quarterUsers.length
          });
        }
        break;
      }
    }

    return { success: true, data: periods };
  } catch (error) {
    logger.error('Error fetching user registration trends:', error);
    return { success: false, data: [] };
  }
};

// Fetch user activity heatmap data
export const fetchUserActivityHeatmap = async () => {
  try {
    const usersResponse = await apiClient.get('/admin/users', { page: 1, limit: 10000 });
    const users = usersResponse?.data || [];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Helper function to format time in 12-hour format
    const formatTime = (hour) => {
      if (hour === 0) return '12:00 AM';
      if (hour < 12) return `${hour}:00 AM`;
      if (hour === 12) return '12:00 PM';
      return `${hour - 12}:00 PM`;
    };

    // Create heatmap data structure
    const heatmapData = [];
    
    dayNames.forEach((dayName, dayIndex) => {
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({
          day: dayName,
          dayIndex: dayIndex,
          hour: hour,
          time: formatTime(hour),
          users: 0,
          period: hour < 6 ? 'Late Night' : 
                  hour < 12 ? 'Morning' : 
                  hour < 17 ? 'Afternoon' : 
                  hour < 21 ? 'Evening' : 'Night'
        });
      }
    });

    // Aggregate user activity by day and time (using last_login as proxy for activity)
    users.forEach(user => {
      if (user.last_login) {
        const loginDate = new Date(user.last_login);
        const dayOfWeek = loginDate.getDay();
        const hour = loginDate.getHours();
        
        const dataPoint = heatmapData.find(d => d.dayIndex === dayOfWeek && d.hour === hour);
        if (dataPoint) {
          dataPoint.users += 1;
        }
      }
    });

    return { success: true, data: heatmapData };
  } catch (error) {
    logger.error('Error fetching user activity heatmap:', error);
    return { success: false, data: [] };
  }
};

// Fetch user order frequency distribution
export const fetchUserOrderFrequencyDistribution = async () => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 10000 });
    const orders = ordersResponse?.data || [];

    // Calculate order counts per user
    const userOrderCounts = {};
    orders.forEach(order => {
      if (order.userId) {
        userOrderCounts[order.userId] = (userOrderCounts[order.userId] || 0) + 1;
      }
    });

    // Define frequency buckets
    const frequencyBuckets = [
      { range: '1 order', min: 1, max: 1, count: 0, users: [] },
      { range: '2-5 orders', min: 2, max: 5, count: 0, users: [] },
      { range: '6-10 orders', min: 6, max: 10, count: 0, users: [] },
      { range: '11-20 orders', min: 11, max: 20, count: 0, users: [] },
      { range: '20+ orders', min: 21, max: Infinity, count: 0, users: [] }
    ];

    // Categorize users into buckets
    Object.values(userOrderCounts).forEach(orderCount => {
      for (const bucket of frequencyBuckets) {
        if (orderCount >= bucket.min && orderCount <= bucket.max) {
          bucket.count++;
          bucket.users.push(orderCount);
          break;
        }
      }
    });

    // Calculate percentages
    const totalUsersWithOrders = Object.keys(userOrderCounts).length;
    const distribution = frequencyBuckets.map(bucket => ({
      range: bucket.range,
      count: bucket.count,
      percentage: totalUsersWithOrders > 0 ? ((bucket.count / totalUsersWithOrders) * 100).toFixed(1) : 0,
      avgOrders: bucket.count > 0 ? bucket.users.reduce((sum, orders) => sum + orders, 0) / bucket.count : 0
    }));

    return { success: true, data: distribution };
  } catch (error) {
    logger.error('Error fetching user order frequency distribution:', error);
    return { success: false, data: [] };
  }
};

// Fetch user value segments
export const fetchUserValueSegments = async () => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 10000 });
    const orders = ordersResponse?.data || [];

    // Calculate total spending per user
    const userSpending = {};
    orders.forEach(order => {
      if (order.userId) {
        const revenue = Number(order.total) || 0;
        userSpending[order.userId] = (userSpending[order.userId] || 0) + revenue;
      }
    });

    const spendingValues = Object.values(userSpending).sort((a, b) => b - a);
    const totalUsers = spendingValues.length;

    if (totalUsers === 0) {
      return { success: true, data: [] };
    }

    // Calculate percentiles
    const highValueThreshold = spendingValues[Math.floor(totalUsers * 0.2) - 1] || 0;
    const mediumValueThreshold = spendingValues[Math.floor(totalUsers * 0.8) - 1] || 0;

    let highValue = 0;
    let mediumValue = 0;
    let lowValue = 0;

    spendingValues.forEach(spending => {
      if (spending >= highValueThreshold) {
        highValue++;
      } else if (spending >= mediumValueThreshold) {
        mediumValue++;
      } else {
        lowValue++;
      }
    });

    const segments = [
      {
        segment: 'High Value',
        count: highValue,
        percentage: totalUsers > 0 ? ((highValue / totalUsers) * 100).toFixed(1) : 0,
        description: 'Top 20% by revenue'
      },
      {
        segment: 'Medium Value',
        count: mediumValue,
        percentage: totalUsers > 0 ? ((mediumValue / totalUsers) * 100).toFixed(1) : 0,
        description: 'Middle 60% by revenue'
      },
      {
        segment: 'Low Value',
        count: lowValue,
        percentage: totalUsers > 0 ? ((lowValue / totalUsers) * 100).toFixed(1) : 0,
        description: 'Bottom 20% by revenue'
      }
    ];

    return { success: true, data: segments };
  } catch (error) {
    logger.error('Error fetching user value segments:', error);
    return { success: false, data: [] };
  }
};

// Fetch geographic distribution of users
export const fetchUserGeographicDistribution = async () => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 10000 });
    const orders = ordersResponse?.data || [];

    // Group users by delivery address location
    const locationStats = {};
    
    orders.forEach(order => {
      if (order.userId && order.deliveryAddress) {
        const location = order.deliveryAddress.city || order.deliveryAddress.neighborhood || 'Unknown';
        const revenue = Number(order.total) || 0;
        
        if (!locationStats[location]) {
          locationStats[location] = {
            location: location,
            users: new Set(),
            orders: 0,
            revenue: 0
          };
        }
        
        locationStats[location].users.add(order.userId);
        locationStats[location].orders += 1;
        locationStats[location].revenue += revenue;
      }
    });

    // Convert to array and calculate metrics
    const distribution = Object.values(locationStats).map(stat => ({
      location: stat.location,
      userCount: stat.users.size,
      orderCount: stat.orders,
      revenue: stat.revenue,
      avgOrderValue: stat.orders > 0 ? stat.revenue / stat.orders : 0,
      avgOrdersPerUser: stat.users.size > 0 ? stat.orders / stat.users.size : 0
    })).sort((a, b) => b.userCount - a.userCount).slice(0, 10);

    return { success: true, data: distribution };
  } catch (error) {
    logger.error('Error fetching user geographic distribution:', error);
    return { success: false, data: [] };
  }
};

// Fetch cohort analysis data
export const fetchUserCohortAnalysis = async () => {
  try {
    const usersResponse = await apiClient.get('/admin/users', { page: 1, limit: 10000 });
    const users = usersResponse?.data || [];
    
    const ordersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 10000 });
    const orders = ordersResponse?.data || [];

    const now = new Date();
    const cohorts = [];

    // Create cohorts for the last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      // Users who signed up in this month
      const cohortUsers = users.filter(user => {
        const signupDate = new Date(user.created_at);
        return signupDate >= monthStart && signupDate <= monthEnd;
      });
      
      const cohortName = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Calculate retention for each subsequent month
      const retentionData = [];
      for (let j = 0; j <= i; j++) {
        const retentionMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + j, 1);
        const retentionMonthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + j + 1, 0);
        
        // Count how many cohort users made orders in this month
        const activeInMonth = cohortUsers.filter(user => {
          const userOrders = orders.filter(order => 
            order.userId === user.id && 
            new Date(order.createdAt) >= retentionMonthStart && 
            new Date(order.createdAt) <= retentionMonthEnd
          );
          return userOrders.length > 0;
        }).length;
        
        const retentionRate = cohortUsers.length > 0 ? (activeInMonth / cohortUsers.length) * 100 : 0;
        
        retentionData.push({
          month: j,
          retentionRate: parseFloat(retentionRate.toFixed(1)),
          activeUsers: activeInMonth
        });
      }
      
      cohorts.push({
        cohort: cohortName,
        totalUsers: cohortUsers.length,
        retentionData: retentionData
      });
    }

    return { success: true, data: cohorts };
  } catch (error) {
    logger.error('Error fetching user cohort analysis:', error);
    return { success: false, data: [] };
  }
};

// Fetch user lifecycle stages
export const fetchUserLifecycleStages = async () => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { page: 1, limit: 10000 });
    const orders = ordersResponse?.data || [];

    // Calculate order counts per user
    const userOrderCounts = {};
    const userLastOrderDates = {};
    
    orders.forEach(order => {
      if (order.userId) {
        userOrderCounts[order.userId] = (userOrderCounts[order.userId] || 0) + 1;
        const orderDate = new Date(order.createdAt);
        if (!userLastOrderDates[order.userId] || orderDate > userLastOrderDates[order.userId]) {
          userLastOrderDates[order.userId] = orderDate;
        }
      }
    });

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

    let newUsers = 0;
    let activeUsers = 0;
    let loyalUsers = 0;
    let vipUsers = 0;
    let churnedUsers = 0;

    Object.entries(userOrderCounts).forEach(([userId, orderCount]) => {
      const lastOrderDate = userLastOrderDates[userId];
      
      if (orderCount === 1) {
        newUsers++;
      } else if (orderCount >= 2 && orderCount <= 5) {
        activeUsers++;
      } else if (orderCount >= 6 && orderCount <= 15) {
        loyalUsers++;
      } else if (orderCount >= 16) {
        vipUsers++;
      }
      
      // Check for churned users (no orders in 90+ days)
      if (lastOrderDate && lastOrderDate < ninetyDaysAgo) {
        churnedUsers++;
      }
    });

    const totalUsers = Object.keys(userOrderCounts).length;
    
    const stages = [
      {
        stage: 'New',
        count: newUsers,
        percentage: totalUsers > 0 ? ((newUsers / totalUsers) * 100).toFixed(1) : 0,
        description: '0-1 orders'
      },
      {
        stage: 'Active',
        count: activeUsers,
        percentage: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
        description: '2-5 orders'
      },
      {
        stage: 'Loyal',
        count: loyalUsers,
        percentage: totalUsers > 0 ? ((loyalUsers / totalUsers) * 100).toFixed(1) : 0,
        description: '6-15 orders'
      },
      {
        stage: 'VIP',
        count: vipUsers,
        percentage: totalUsers > 0 ? ((vipUsers / totalUsers) * 100).toFixed(1) : 0,
        description: '15+ orders'
      },
      {
        stage: 'Churned',
        count: churnedUsers,
        percentage: totalUsers > 0 ? ((churnedUsers / totalUsers) * 100).toFixed(1) : 0,
        description: 'No orders in 90+ days'
      }
    ];

    return { success: true, data: stages };
  } catch (error) {
    logger.error('Error fetching user lifecycle stages:', error);
    return { success: false, data: [] };
  }
};

// Fetch user order patterns
export const fetchUserOrderPatterns = async (timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Calculate user order counts and spending
    const userStats = {};
    orders.forEach(order => {
      if (order.userId) {
        const revenue = Number(order.total) || 0;
        if (!userStats[order.userId]) {
          userStats[order.userId] = {
            userId: order.userId,
            orders: 0,
            revenue: 0
          };
        }
        userStats[order.userId].orders += 1;
        userStats[order.userId].revenue += revenue;
      }
    });

    // Convert to array and sort by order count
    const userStatsArray = Object.values(userStats).map(user => ({
      ...user,
      avgOrderValue: user.orders > 0 ? user.revenue / user.orders : 0
    })).sort((a, b) => b.orders - a.orders);

    // Create segments based on order frequency
    const segments = [
      { name: 'New Users', minOrders: 1, maxOrders: 1, users: [], avgOrderValue: 0 },
      { name: 'Regular Users', minOrders: 2, maxOrders: 5, users: [], avgOrderValue: 0 },
      { name: 'Frequent Users', minOrders: 6, maxOrders: 10, users: [], avgOrderValue: 0 },
      { name: 'Power Users', minOrders: 11, maxOrders: Infinity, users: [], avgOrderValue: 0 }
    ];

    segments.forEach(segment => {
      segment.users = userStatsArray.filter(user => 
        user.orders >= segment.minOrders && user.orders <= segment.maxOrders
      );
      segment.avgOrderValue = segment.users.length > 0 
        ? segment.users.reduce((sum, user) => sum + user.avgOrderValue, 0) / segment.users.length 
        : 0;
      segment.userCount = segment.users.length;
    });

    return { success: true, data: segments };
  } catch (error) {
    logger.error('Error fetching user order patterns:', error);
    return { success: false, data: [] };
  }
};

// ===== SUPPORT =====

export const fetchSupportTickets = async (filters = {}) => {
  try {
    const response = await apiClient.get('/admin/support/tickets', filters);
    return { success: true, data: response.data, pagination: response.pagination };
  } catch (error) {
    logger.error('Error fetching support tickets:', error);
    return { success: false, error: error.message };
  }
};

export const updateTicketStatus = async (ticketId, status, prevDisplay) => {
  try {
    const response = await apiClient.patch(`/admin/support/tickets/${ticketId}/status`, { status, ...(prevDisplay ? { prevDisplay } : {}) });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating ticket status:', error);
    return { success: false, error: error.message };
  }
};

export const addTicketResponse = async (ticketId, message, isInternal = false) => {
  try {
    const response = await apiClient.post(`/admin/support/tickets/${ticketId}/responses`, {
      message,
      isInternal
    });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error adding ticket response:', error);
    return { success: false, error: error.message };
  }
};

// Public endpoint to create a support ticket from site forms
export const createSupportTicket = async (payload) => {
  try {
    const response = await apiClient.post('/support/tickets', payload);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    return { success: false, error: error.message };
  }
};

export const deleteClosedSupportTickets = async () => {
  try {
    const response = await apiClient.delete('/admin/support/tickets/closed');
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error deleting closed tickets:', error);
    return { success: false, error: error.message };
  }
};

// ===== NOTIFICATIONS =====
export const fetchAdminNotifications = async (limit = 250) => {
  try {
    const response = await apiClient.get('/admin/notifications', { limit });
    return { success: true, data: response.data, unreadCount: response.unreadCount };
  } catch (error) {
    if (error?.message && error.message.includes('not found')) {
      return { success: true, data: [], unreadCount: 0 };
    }
    logger.error('Error fetching admin notifications:', error);
    return { success: false, error: error.message };
  }
};

export const markNotificationRead = async (id, read = true) => {
  try {
    const response = await apiClient.patch(`/admin/notifications/${id}/read`, { read });
    return { success: true, unreadCount: response.unreadCount };
  } catch (error) {
    logger.error('Error marking notification read:', error);
    return { success: false, error: error.message };
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const response = await apiClient.patch('/admin/notifications/read-all');
    return { success: true, unreadCount: response.unreadCount };
  } catch (error) {
    logger.error('Error marking all notifications read:', error);
    return { success: false, error: error.message };
  }
};

export const deleteNotification = async (id) => {
  try {
    const response = await apiClient.delete(`/admin/notifications/${id}`);
    return { success: true, unreadCount: response.unreadCount };
  } catch (error) {
    logger.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};

// Fetch short-lived SSE token for orders/notifications stream
export const fetchOrdersStreamToken = async () => {
  try {
    const response = await apiClient.post('/admin/orders/stream-token', {});
    return { success: true, token: response.token };
  } catch (error) {
    logger.error('Error fetching orders stream token:', error);
    return { success: false, error: error.message };
  }
};

// ===== SYSTEM SETTINGS =====

export const fetchSystemSettings = async () => {
  try {
    const response = await apiClient.get('/admin/settings');
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error fetching system settings:', error);
    return { success: false, error: error.message };
  }
};

export const updateSystemSetting = async (key, value) => {
  try {
    const response = await apiClient.put('/admin/settings', { key, value });
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating system setting:', error);
    return { success: false, error: error.message };
  }
};

// ===== COUNTS FOR SIDEBAR BADGES =====

export const fetchNotificationCounts = async () => {
  try {
    // Active orders = not delivered or cancelled
    const activeStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery'];

    const results = await Promise.all(
      activeStatuses.map(status => apiClient.get('/admin/orders', { status, page: 1, limit: 1 }))
    );

    const activeOrders = results.reduce((sum, resp) => sum + (resp?.pagination?.total || 0), 0);

    // Count active tickets (open and in_progress support tickets + pending menu change requests)
    const [supportTicketsResp, menuRequestsResp] = await Promise.all([
      apiClient.get('/admin/support-tickets', { status: 'open,in_progress', page: 1, limit: 1 }),
      apiClient.get('/admin/menu-change-requests', { status: 'pending', page: 1, limit: 1 })
    ]);

    const activeTickets = (supportTicketsResp?.pagination?.total || 0) + (menuRequestsResp?.pagination?.total || 0);

    return { success: true, data: { orders: activeOrders, tickets: activeTickets, users: 0 } };
  } catch (error) {
    logger.error('Error fetching notification counts:', error);
    return { success: false, data: { orders: 0, tickets: 0, users: 0 }, error: error.message };
  }
};

export const createRestaurant = async (restaurantData) => {
  try {
    const response = await apiClient.post('/admin/restaurants', restaurantData);
    return { success: true, data: response };
  } catch (error) {
    logger.error('Error creating restaurant:', error);
    return { success: false, error: error.message };
  }
};

export const logAdminAction = async (adminId, action, tableName, recordId, oldValues, newValues) => {
  try {
    // For now, just log to console - implement audit logging when ready
    logger.info('Admin action logged', {
      adminId,
      action,
      tableName,
      recordId,
      oldValues,
      newValues
    });
    return { success: true };
  } catch (error) {
    logger.error('Error logging admin action:', error);
    return { success: false, error: error.message };
  }
};

export const fetchAuditLogs = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add filter parameters
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);
    if (filters.action && filters.action !== 'all') queryParams.append('action', filters.action);
    if (filters.table && filters.table !== 'all') queryParams.append('table', filters.table);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.adminId) queryParams.append('adminId', filters.adminId);
    
    const response = await apiClient.get(`/admin/audit-logs?${queryParams.toString()}`);
    
    if (response.success) {
      return {
        success: true,
        data: response.data,
        pagination: response.pagination
      };
    }
    
    throw new Error(response.error || 'Failed to fetch audit logs');
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { success: false, error: error.message };
  }
};

// Fetch top menu items for a specific restaurant
export const fetchRestaurantMenuItems = async (restaurantId, timeRange = '30d') => {
  try {
    const ordersResponse = await apiClient.get('/admin/orders', { 
      page: 1, 
      limit: 10000,
      ...getDateFilter(timeRange)
    });
    const orders = ordersResponse?.data || [];

    // Get restaurant info
    const restaurantsResponse = await apiClient.get('/admin/restaurants', { page: 1, limit: 10000 });
    const restaurants = restaurantsResponse?.data || [];
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
      return { success: false, error: 'Restaurant not found' };
    }

    // Count menu items from this restaurant
    const menuItemCounts = {};
    
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          // Check if this item belongs to the specified restaurant
          if (item.restaurantId === restaurantId || item.restaurant?.id === restaurantId) {
            const itemKey = `${item.name}_${item.price}`; // Use name + price as unique key
            if (!menuItemCounts[itemKey]) {
              menuItemCounts[itemKey] = {
                name: item.name,
                price: item.price,
                quantity: 0,
                revenue: 0
              };
            }
            menuItemCounts[itemKey].quantity += Number(item.quantity) || 1;
            menuItemCounts[itemKey].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
          }
        });
      }
    });

    // Convert to array and sort by quantity
    const topMenuItems = Object.values(menuItemCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return { 
      success: true, 
      data: topMenuItems,
      restaurant: restaurant
    };
  } catch (error) {
    logger.error('Error fetching restaurant menu items:', error);
    return { success: false, data: [] };
  }
};

// ===== UTILITY FUNCTIONS =====

export const uploadRestaurantLogo = async (file) => {
  try {
    console.log('Uploading file:', file.name, file.type, file.size);
    console.log('Auth token present:', !!apiClient.getToken());
    const form = new FormData();
    form.append('logo', file);
    
    // Get the token manually to ensure it's included
    const token = apiClient.getToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await apiClient.request('/admin/restaurants/logo/upload', {
      method: 'POST',
      body: form,
      headers
    });
    console.log('Upload response:', response);
    console.log('Response filename:', response.filename);
    return { success: true, filename: response.filename };
  } catch (error) {
    console.error('Upload error:', error);
    logger.error('Error uploading restaurant logo:', error);
    return { success: false, error: error.message };
  }
};


import apiClient from '../lib/api';


export const fetchUserProfile = async (userId) => {
  try {
    const response = await apiClient.get(`/profiles/${userId}`);
    return response;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId, updates) => {
  try {
    const response = await apiClient.put(`/profiles/${userId}`, updates);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: error.message };
  }
};


export const fetchUserOrders = async (userId, filters = {}) => {
  try {
    const params = {};
    
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'in_progress') {
        params.status = 'pending';
      } else {
        params.status = filters.status;
      }
    }

    if (filters.dateRange) {
      const now = new Date();
      let startDate;
      
      switch (filters.dateRange) {
        case 'recent':
          startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          break;
        case '30_days':
          startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
        case '3_months':
          startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        params.startDate = startDate.toISOString();
      }
    }

    const response = await apiClient.get(`/orders/user/${userId}`, params);

    const normalizeOrders = (orders) => {
      return orders.map(order => {
        if (!order) return order;

        let restaurantGroups = order.restaurantGroups || order.restaurant_groups || null;
        if (restaurantGroups && typeof restaurantGroups === 'object' && !Array.isArray(restaurantGroups)) {
          const normalizedGroups = {};
          Object.entries(restaurantGroups).forEach(([restaurantId, group]) => {
            if (!group) return;
            const groupItems = Array.isArray(group.items)
              ? group.items
              : (typeof group.items === 'object' ? Object.values(group.items) : []);
            normalizedGroups[restaurantId] = {
              ...group,
              items: groupItems
            };
          });
          restaurantGroups = normalizedGroups;
        }

        let restaurants = order.restaurants || [];
        if (restaurantGroups && (!restaurants || restaurants.length === 0)) {
          restaurants = Object.keys(restaurantGroups).map(id => ({
            id,
            name: id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
          }));
        }

        return {
          ...order,
          restaurantGroups,
          restaurants,
          restaurant: order.restaurant || (
            restaurants && restaurants.length === 1 ? restaurants[0] : null
          )
        };
      });
    };
    
    if (filters.status === 'in_progress') {
      return normalizeOrders(response.filter(order => 
        ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status)
      ));
    }
    
    return normalizeOrders(response);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};

export const fetchOrderById = async (orderId) => {
  try {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response;
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
};

export const reorderItems = async (orderId) => {
  try {
    const response = await apiClient.post(`/orders/${orderId}/reorder`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error reordering items:', error);
    return { success: false, error: error.message };
  }
};

export const fetchUserStats = async (userId) => {
  try {
    const response = await apiClient.get(`/profiles/${userId}/stats`);
    return response;
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return {
      totalOrders: 0,
      totalSpent: 0,
      favoriteRestaurantsCount: 0
    };
  }
};

export const fetchUserPreferences = async () => {
  return {};
};

export const updateUserPreferences = async () => ({ success: true });

export const fetchUserPaymentMethods = async () => {
  try {
    const response = await apiClient.get('/payments/methods');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return [];
  }
};

export const addPaymentMethod = async (paymentMethodData) => {
  try {
    const response = await apiClient.post('/payments/methods', paymentMethodData);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error adding payment method:', error);
    return { success: false, error: error.message };
  }
};

export const removePaymentMethod = async (paymentMethodId) => {
  try {
    await apiClient.delete(`/payments/methods/${paymentMethodId}`);
    return { success: true };
  } catch (error) {
    console.error('Error removing payment method:', error);
    return { success: false, error: error.message };
  }
};

export const setDefaultPaymentMethod = async (paymentMethodId) => {
  try {
    const response = await apiClient.patch(`/payments/methods/${paymentMethodId}/default`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error setting default payment method:', error);
    return { success: false, error: error.message };
  }
};

export const fetchUserLoginActivity = async () => {
  return [];
};

export const logUserLogin = async () => ({ success: true });

export const deleteUserAccount = async () => ({ success: true });

export const subscribeToOrderUpdates = () => ({ unsubscribe: () => {} });

export const unsubscribeFromOrderUpdates = (subscription) => {
  if (subscription && subscription.unsubscribe) {
    subscription.unsubscribe();
  }
}; 
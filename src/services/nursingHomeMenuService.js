import api from '../lib/api';
import logger from '../utils/logger';

export const fetchNursingHomeMenu = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.mealType && filters.mealType !== 'all') {
      params.append('mealType', filters.mealType);
    }
    if (filters.category && filters.category !== 'all') {
      params.append('category', filters.category);
    }
    if (filters.isActive !== undefined) {
      params.append('isActive', filters.isActive);
    }

    const queryString = params.toString();
    const url = queryString ? `/nursing-homes/menu?${queryString}` : '/nursing-homes/menu';
    const response = await api.get(url);
    const body = response?.data ?? response;
    const items = Array.isArray(body?.data?.items) ? body.data.items : (Array.isArray(body?.items) ? body.items : []);
    const grouped = body?.data?.grouped ?? body?.grouped ?? {};
    if (import.meta.env.DEV) {
      console.debug('[DEBUG] NH menu: response shape and extracted items count', { itemsLength: items.length });
    }
    return { success: true, data: { items, grouped } };
  } catch (error) {
    logger.error('Error fetching nursing home menu:', error);
    return {
      success: false,
      error: error?.message || error?.response?.data?.error || 'Failed to fetch menu'
    };
  }
};

export const createNursingHomeMenuItem = async (menuItemData) => {
  try {
    const response = await api.post('/nursing-homes/menu', menuItemData);
    return { success: true, data: response.data.data };
  } catch (error) {
    logger.error('Error creating nursing home menu item:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to create menu item' 
    };
  }
};

export const updateNursingHomeMenuItem = async (id, menuItemData) => {
  try {
    const response = await api.put(`/nursing-homes/menu/${id}`, menuItemData);
    return { success: true, data: response.data.data };
  } catch (error) {
    logger.error('Error updating nursing home menu item:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to update menu item' 
    };
  }
};

export const deleteNursingHomeMenuItem = async (id) => {
  try {
    const response = await api.delete(`/nursing-homes/menu/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error deleting nursing home menu item:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to delete menu item' 
    };
  }
};

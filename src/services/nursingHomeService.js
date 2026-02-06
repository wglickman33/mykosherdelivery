import api from '../lib/api';
import logger from '../utils/logger';

export const fetchResidents = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = `/nursing-homes/residents${queryParams ? `?${queryParams}` : ''}`;
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    logger.error('Error fetching residents:', error);
    throw error;
  }
};

export const fetchResident = async (id) => {
  try {
    const response = await api.get(`/nursing-homes/residents/${id}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching resident ${id}:`, error);
    throw error;
  }
};

export const fetchMenuItems = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = `/nursing-homes/menu${queryParams ? `?${queryParams}` : ''}`;
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    logger.error('Error fetching menu items:', error);
    throw error;
  }
};

export const fetchResidentOrders = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = `/nursing-homes/resident-orders${queryParams ? `?${queryParams}` : ''}`;
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    logger.error('Error fetching resident orders:', error);
    throw error;
  }
};

export const createResidentOrder = async (orderData) => {
  try {
    const response = await api.post('/nursing-homes/resident-orders', orderData);
    return response.data;
  } catch (error) {
    logger.error('Error creating resident order:', error);
    throw error;
  }
};

export const updateResidentOrder = async (id, orderData) => {
  try {
    const response = await api.put(`/nursing-homes/resident-orders/${id}`, orderData);
    return response.data;
  } catch (error) {
    logger.error(`Error updating resident order ${id}:`, error);
    throw error;
  }
};

export const submitAndPayOrder = async (id, paymentData) => {
  try {
    const response = await api.post(`/nursing-homes/resident-orders/${id}/submit-and-pay`, paymentData);
    return response.data;
  } catch (error) {
    logger.error(`Error submitting and paying order ${id}:`, error);
    throw error;
  }
};

export const exportResidentOrder = async (id) => {
  try {
    const response = await api.get(`/nursing-homes/resident-orders/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    logger.error(`Error exporting resident order ${id}:`, error);
    throw error;
  }
};

export const fetchFacility = async (id) => {
  try {
    const response = await api.get(`/nursing-homes/facilities/${id}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching facility ${id}:`, error);
    throw error;
  }
};

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const fetchResidents = async (params = {}) => {
  const response = await axios.get(`${API_URL}/api/nursing-homes/residents`, {
    headers: getAuthHeaders(),
    params
  });
  return response.data;
};

export const fetchResident = async (id) => {
  const response = await axios.get(`${API_URL}/api/nursing-homes/residents/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const fetchMenuItems = async (params = {}) => {
  const response = await axios.get(`${API_URL}/api/nursing-homes/menu`, {
    headers: getAuthHeaders(),
    params
  });
  return response.data;
};

export const fetchResidentOrders = async (params = {}) => {
  const response = await axios.get(`${API_URL}/api/nursing-homes/resident-orders`, {
    headers: getAuthHeaders(),
    params
  });
  return response.data;
};

export const createResidentOrder = async (orderData) => {
  const response = await axios.post(`${API_URL}/api/nursing-homes/resident-orders`, orderData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const updateResidentOrder = async (id, orderData) => {
  const response = await axios.put(`${API_URL}/api/nursing-homes/resident-orders/${id}`, orderData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const submitAndPayOrder = async (id, paymentData) => {
  const response = await axios.post(`${API_URL}/api/nursing-homes/resident-orders/${id}/submit-and-pay`, paymentData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const exportResidentOrder = async (id) => {
  const response = await axios.get(`${API_URL}/api/nursing-homes/resident-orders/${id}/export`, {
    headers: getAuthHeaders(),
    responseType: 'blob'
  });
  return response.data;
};

export const fetchFacility = async (id) => {
  const response = await axios.get(`${API_URL}/api/nursing-homes/facilities/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

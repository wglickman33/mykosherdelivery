import api from '../lib/api';
import logger from '../utils/logger';

/** Returns axios response. On 404 (e.g. backend not yet deployed with admin routes first) returns empty data so UI can show empty state without throwing. */
export const fetchResidents = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = `/nursing-homes/residents${queryParams ? `?${queryParams}` : ''}`;
    const response = await api.get(endpoint);
    return response;
  } catch (error) {
    if (error.response?.status === 404) {
      logger.warn('Nursing home residents endpoint not found (404). Redeploy backend so /api/nursing-homes uses admin routes first.');
      const page = parseInt(params.page, 10) || 1;
      const limit = parseInt(params.limit, 10) || 50;
      return {
        data: {
          success: true,
          data: [],
          pagination: { total: 0, page, limit, totalPages: 0 }
        }
      };
    }
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
    return response;
  } catch (error) {
    logger.error('Error fetching resident orders:', error);
    throw error;
  }
};

export const fetchResidentOrder = async (id) => {
  try {
    const response = await api.get(`/nursing-homes/resident-orders/${id}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching resident order ${id}:`, error);
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

/** For NH portal: current facility (for admin pass ?facilityId=) */
export const fetchCurrentFacility = async (facilityId = null) => {
  try {
    const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
    const response = await api.get(`/nursing-homes/facilities/current${query}`);
    return response.data;
  } catch (error) {
    logger.error('Error fetching current facility:', error);
    throw error;
  }
};

/** Admin only: list all facilities (for sidebar communities). Returns { data, pagination } (data array). On 404/5xx returns { data: [], success: false, pagination }. */
export const fetchFacilitiesList = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = `/nursing-homes/facilities${queryParams ? `?${queryParams}` : ''}`;
    const response = await api.get(endpoint);
    return { data: response?.data ?? [], success: response?.success !== false, pagination: response?.pagination ?? { total: 0, page: 1, limit: 50, totalPages: 0 } };
  } catch (error) {
    if (error.response?.status === 404) {
      logger.warn('Nursing home facilities endpoint not found (404). Redeploy backend so /api/nursing-homes uses admin routes first.');
      return { data: [], success: true, pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } };
    }
    logger.error('Error fetching facilities list:', error);
    return { data: [], success: false, pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } };
  }
};

/** Admin only: create facility */
export const createFacility = async (data) => {
  try {
    const response = await api.post('/nursing-homes/facilities', data);
    return response.data;
  } catch (error) {
    logger.error('Error creating facility:', error);
    throw error;
  }
};

/** Admin only: update facility */
export const updateFacility = async (id, data) => {
  try {
    const response = await api.put(`/nursing-homes/facilities/${id}`, data);
    return response.data;
  } catch (error) {
    logger.error('Error updating facility:', error);
    throw error;
  }
};

/** Admin only: delete (deactivate) facility */
export const deleteFacility = async (id) => {
  try {
    const response = await api.delete(`/nursing-homes/facilities/${id}`);
    return response.data;
  } catch (error) {
    logger.error('Error deleting facility:', error);
    throw error;
  }
};

/** Create resident (admin or nursing_home_admin) */
export const createResident = async (data) => {
  try {
    const response = await api.post('/nursing-homes/residents', data);
    return response.data;
  } catch (error) {
    logger.error('Error creating resident:', error);
    throw error;
  }
};

/** Update resident */
export const updateResident = async (id, data) => {
  try {
    const response = await api.put(`/nursing-homes/residents/${id}`, data);
    return response.data;
  } catch (error) {
    logger.error('Error updating resident:', error);
    throw error;
  }
};

/** Deactivate resident */
export const deleteResident = async (id) => {
  try {
    const response = await api.delete(`/nursing-homes/residents/${id}`);
    return response.data;
  } catch (error) {
    logger.error('Error deactivating resident:', error);
    throw error;
  }
};

/** Assign resident to staff */
export const assignResidentToStaff = async (residentId, assignedUserId) => {
  try {
    const response = await api.post(`/nursing-homes/residents/${residentId}/assign`, { assignedUserId });
    return response.data;
  } catch (error) {
    logger.error('Error assigning resident:', error);
    throw error;
  }
};

/** Create staff for a facility */
export const createStaff = async (facilityId, data) => {
  try {
    const response = await api.post(`/nursing-homes/facilities/${facilityId}/staff`, data);
    return response.data;
  } catch (error) {
    logger.error('Error creating staff:', error);
    throw error;
  }
};

/** Update staff */
export const updateStaff = async (facilityId, userId, data) => {
  try {
    const response = await api.put(`/nursing-homes/facilities/${facilityId}/staff/${userId}`, data);
    return response.data;
  } catch (error) {
    logger.error('Error updating staff:', error);
    throw error;
  }
};

/** Remove staff from facility */
export const deleteStaff = async (facilityId, userId) => {
  try {
    const response = await api.delete(`/nursing-homes/facilities/${facilityId}/staff/${userId}`);
    return response.data;
  } catch (error) {
    logger.error('Error removing staff:', error);
    throw error;
  }
};

/** Bulk create staff (e.g. from spreadsheet) */
export const bulkCreateStaff = async (facilityId, staffList) => {
  try {
    const response = await api.post(`/nursing-homes/facilities/${facilityId}/staff/bulk`, { staff: staffList });
    return response.data;
  } catch (error) {
    logger.error('Error bulk creating staff:', error);
    throw error;
  }
};

import apiClient from '../lib/api';

const OWNER_BASE = '/owner';

export async function getOwnerRestaurants() {
  const res = await apiClient.get(`${OWNER_BASE}/me`);
  return res?.data ?? [];
}

export async function getRestaurant(restaurantId) {
  const res = await apiClient.get(`${OWNER_BASE}/restaurants/${restaurantId}`);
  if (!res?.success) throw new Error(res?.message || 'Failed to load restaurant');
  return res.data;
}

export async function getMenuItems(restaurantId, params = {}) {
  const res = await apiClient.get(`${OWNER_BASE}/restaurants/${restaurantId}/menu-items`, params);
  if (!res?.success) throw new Error(res?.message || 'Failed to load menu items');
  return { data: res.data || [], pagination: res.pagination };
}

export async function getMenuItem(restaurantId, itemId) {
  const res = await apiClient.get(`${OWNER_BASE}/restaurants/${restaurantId}/menu-items/${itemId}`);
  if (!res?.success) throw new Error(res?.message || 'Failed to load menu item');
  return res.data;
}

export async function createMenuItem(restaurantId, data) {
  const res = await apiClient.post(`${OWNER_BASE}/restaurants/${restaurantId}/menu-items`, data);
  if (!res?.success) throw new Error(res?.message || 'Failed to create menu item');
  return { success: true, data: res.data };
}

export async function updateMenuItem(restaurantId, itemId, data) {
  const res = await apiClient.put(`${OWNER_BASE}/restaurants/${restaurantId}/menu-items/${itemId}`, data);
  if (!res?.success) throw new Error(res?.message || 'Failed to update menu item');
  return { success: true, data: res.data };
}

export async function deleteMenuItem(restaurantId, itemId) {
  const res = await apiClient.delete(`${OWNER_BASE}/restaurants/${restaurantId}/menu-items/${itemId}`);
  if (!res?.success) throw new Error(res?.message || 'Failed to delete menu item');
  return res;
}

export async function importMenuFile(restaurantId, file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.replace) formData.append('replace', 'true');
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const token = apiClient.getToken?.();
  const res = await fetch(`${baseURL}${OWNER_BASE}/restaurants/${restaurantId}/menu/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Import failed: ${res.status}`);
  return data;
}

export async function getOrders(params = {}) {
  const res = await apiClient.get(`${OWNER_BASE}/orders`, params);
  if (!res?.success) throw new Error(res?.message || 'Failed to load orders');
  return { data: res.data || [], pagination: res.pagination };
}

export async function getOrder(orderId) {
  const res = await apiClient.get(`${OWNER_BASE}/orders/${orderId}`);
  if (!res?.success) throw new Error(res?.message || 'Failed to load order');
  return res.data;
}

export async function updateOrder(orderId, data) {
  const res = await apiClient.patch(`${OWNER_BASE}/orders/${orderId}`, data);
  if (!res?.success) throw new Error(res?.message || 'Failed to update order');
  return { success: true, data: res.data };
}

export async function cancelOrder(orderId) {
  const res = await apiClient.delete(`${OWNER_BASE}/orders/${orderId}`);
  if (!res?.success) throw new Error(res?.message || 'Failed to cancel order');
  return res;
}

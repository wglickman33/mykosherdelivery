import api from '../lib/api';

const MAPS_BASE = '/maps';
const ADMIN_MAPS_BASE = '/admin/maps';

export async function getMapsAccess() {
  const res = await api.get(`${MAPS_BASE}/access`);
  return res;
}

export async function getMapsRestaurants(params = {}) {
  const res = await api.get(`${MAPS_BASE}/restaurants`, params);
  return res;
}

export async function getAdminMapsRestaurants(params = {}) {
  const res = await api.get(`${ADMIN_MAPS_BASE}/restaurants`, params);
  return res;
}

export async function createAdminMapsRestaurant(data) {
  const res = await api.post(`${ADMIN_MAPS_BASE}/restaurants`, data);
  return res;
}

export async function updateAdminMapsRestaurant(id, data) {
  const res = await api.put(`${ADMIN_MAPS_BASE}/restaurants/${id}`, data);
  return res;
}

export async function importAdminMapsRestaurantsCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  const token = api.getToken();
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const response = await fetch(`${baseURL}${ADMIN_MAPS_BASE}/restaurants/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Import failed: ${response.status}`);
  }
  return response.json();
}

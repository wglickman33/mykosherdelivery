import apiClient from '../lib/api';
import { buildImageUrl } from './imageService';
import {
  validateMenuItemData,
  normalizeMenuItemData,
  getItemTypeDisplayName,
  getDefaultOptions
} from './menuItemService';

export { validateMenuItemData, normalizeMenuItemData, getItemTypeDisplayName, getDefaultOptions };

export const normalizeKiddushMenuItem = (item) => {
  const rawImageUrl = item.imageUrl || item.image || null;
  const image = rawImageUrl ? buildImageUrl(rawImageUrl) : null;

  return {
    ...item,
    image,
    imageUrl: rawImageUrl,
    price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
    featured: item.featured === true,
    available: item.available !== false,
    itemType: item.itemType || 'simple',
    labels: Array.isArray(item.labels) ? item.labels : [],
    displayOrder: item.displayOrder ?? 0
  };
};

export const fetchKiddushMenuItems = async (packageId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'all') params.append('category', filters.category);
  if (filters.available !== undefined) params.append('available', filters.available);
  if (filters.itemType && filters.itemType !== 'all') params.append('itemType', filters.itemType);
  if (filters.search) params.append('search', filters.search);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);

  const qs = params.toString();
  const response = await apiClient.get(
    `/admin/kiddush-packages/${packageId}/menu-items${qs ? `?${qs}` : ''}`
  );

  const data = Array.isArray(response.data) ? response.data.map(normalizeKiddushMenuItem) : [];
  return { ...response, data, pagination: response.pagination };
};

export const fetchKiddushMenuItem = async (packageId, itemId) => {
  const response = await apiClient.get(`/admin/kiddush-packages/${packageId}/menu-items/${itemId}`);
  const item = response?.data ?? response;
  return { ...response, data: item ? normalizeKiddushMenuItem(item) : item };
};

export const createKiddushMenuItem = async (packageId, menuItemData) => {
  const response = await apiClient.post(
    `/admin/kiddush-packages/${packageId}/menu-items`,
    menuItemData
  );
  const item = response?.data ?? response;
  return { ...response, data: item ? normalizeKiddushMenuItem(item) : item };
};

export const updateKiddushMenuItem = async (packageId, itemId, updateData) => {
  const response = await apiClient.put(
    `/admin/kiddush-packages/${packageId}/menu-items/${itemId}`,
    updateData
  );
  const item = response?.data ?? response;
  return { ...response, data: item ? normalizeKiddushMenuItem(item) : item };
};

export const deleteKiddushMenuItem = async (packageId, itemId) => {
  return apiClient.delete(`/admin/kiddush-packages/${packageId}/menu-items/${itemId}`);
};

export const duplicateKiddushMenuItem = async (packageId, itemId) => {
  const response = await apiClient.post(
    `/admin/kiddush-packages/${packageId}/menu-items/${itemId}/duplicate`
  );
  const item = response?.data ?? response;
  return { ...response, data: item ? normalizeKiddushMenuItem(item) : item };
};

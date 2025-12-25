import apiClient from '../lib/api';
import logger from '../utils/logger';


export const uploadRestaurantLogo = async (file) => {
  try {
    console.log('Uploading restaurant logo:', file.name, file.type, file.size);
    
    const formData = new FormData();
    formData.append('logo', file);
    
    const token = apiClient.getToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await apiClient.request('/images/restaurant-logo', {
      method: 'POST',
      body: formData,
      headers
    });
    
    console.log('Restaurant logo upload response:', response);
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('Restaurant logo upload error:', error);
    logger.error('Error uploading restaurant logo:', error);
    return { success: false, error: error.message };
  }
};


export const uploadMenuItemImage = async (file) => {
  try {
    console.log('Uploading menu item image:', file.name, file.type, file.size);
    
    const formData = new FormData();
    formData.append('image', file);
    
    const token = apiClient.getToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await apiClient.request('/images/menu-item', {
      method: 'POST',
      body: formData,
      headers
    });
    
    console.log('Menu item image upload response:', response);
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('Menu item image upload error:', error);
    logger.error('Error uploading menu item image:', error);
    return { success: false, error: error.message };
  }
};


export const getImageInfo = async (type, filename) => {
  try {
    const response = await apiClient.get(`/images/info/${type}/${filename}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error getting image info:', error);
    return { success: false, error: error.message };
  }
};


export const deleteImage = async (type, filename) => {
  try {
    const response = await apiClient.delete(`/images/${type}/${filename}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error deleting image:', error);
    return { success: false, error: error.message };
  }
};


export const listImages = async (type) => {
  try {
    const response = await apiClient.get(`/images/list/${type}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error listing images:', error);
    return { success: false, error: error.message };
  }
};


export const buildImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  if (imagePath.startsWith('/')) {
    return imagePath;
  }
  
  let baseUrl = '';
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  if (apiBase) {
    baseUrl = apiBase.replace(/\/?api\/?$/, '');
  }
  
  if (!baseUrl && typeof window !== 'undefined') {
    baseUrl = window.location.origin.includes(':5173') ? 'http://localhost:3001' : window.location.origin;
  }
  
  return `${baseUrl}/${imagePath}`;
};


export const getImageVariantUrl = (filename, type, size = 'optimized') => {
  const baseName = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const variantPath = `images/${type}/variants/${baseName}_${size}.jpg`;
  return buildImageUrl(variantPath);
};

import apiClient from '../lib/api';
import logger from '../utils/logger';

/**
 * Upload a restaurant logo
 * @param {File} file - The image file to upload
 * @returns {Promise<{success: boolean, data?: {filename: string, variants: Array, originalUrl: string}, error?: string}>}
 */
export const uploadRestaurantLogo = async (file) => {
  try {
    console.log('Uploading restaurant logo:', file.name, file.type, file.size);
    
    const formData = new FormData();
    formData.append('logo', file);
    
    // Get the token manually to ensure it's included
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

/**
 * Upload a menu item image
 * @param {File} file - The image file to upload
 * @returns {Promise<{success: boolean, data?: {filename: string, variants: Array, originalUrl: string}, error?: string}>}
 */
export const uploadMenuItemImage = async (file) => {
  try {
    console.log('Uploading menu item image:', file.name, file.type, file.size);
    
    const formData = new FormData();
    formData.append('image', file);
    
    // Get the token manually to ensure it's included
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

/**
 * Get image information including variants
 * @param {string} type - Image type ('restaurant-logos' or 'menu-items')
 * @param {string} filename - The filename
 * @returns {Promise<{success: boolean, data?: {filename: string, variants: Object}, error?: string}>}
 */
export const getImageInfo = async (type, filename) => {
  try {
    const response = await apiClient.get(`/images/info/${type}/${filename}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error getting image info:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete an image and all its variants
 * @param {string} type - Image type ('restaurant-logos' or 'menu-items')
 * @param {string} filename - The filename
 * @returns {Promise<{success: boolean, data?: {deletedCount: number}, error?: string}>}
 */
export const deleteImage = async (type, filename) => {
  try {
    const response = await apiClient.delete(`/images/${type}/${filename}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error deleting image:', error);
    return { success: false, error: error.message };
  }
};

/**
 * List all images of a specific type
 * @param {string} type - Image type ('restaurant-logos' or 'menu-items')
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const listImages = async (type) => {
  try {
    const response = await apiClient.get(`/images/list/${type}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error listing images:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Build a complete image URL from a relative path
 * @param {string} imagePath - Relative image path (e.g., 'images/restaurant-logos/variants/filename_optimized.jpg')
 * @returns {string} Complete URL
 */
export const buildImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  // If it's already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it starts with '/', it's already a server-relative path
  if (imagePath.startsWith('/')) {
    return imagePath;
  }
  
  // Build the complete URL
  let baseUrl = '';
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  if (apiBase) {
    baseUrl = apiBase.replace(/\/?api\/?$/, '');
  }
  
  if (!baseUrl && typeof window !== 'undefined') {
    // Dev fallback: if running on 5173, use 3001; else use current origin
    baseUrl = window.location.origin.includes(':5173') ? 'http://localhost:3001' : window.location.origin;
  }
  
  return `${baseUrl}/${imagePath}`;
};

/**
 * Get the best image variant URL for a given size
 * @param {string} filename - The base filename
 * @param {string} type - Image type ('restaurant-logos' or 'menu-items')
 * @param {string} size - Desired size ('thumbnail', 'medium', 'optimized')
 * @returns {string} Complete URL for the variant
 */
export const getImageVariantUrl = (filename, type, size = 'optimized') => {
  const baseName = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const variantPath = `images/${type}/variants/${baseName}_${size}.jpg`;
  return buildImageUrl(variantPath);
};

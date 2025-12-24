import apiClient from '../lib/api';
import { buildImageUrl } from './imageService';
import { normalizeMenuItem } from './menuItemService';

// Simple rate limiter to prevent overwhelming the API
class RateLimiter {
  constructor(maxRequests = 5, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async wait() {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // If we're at the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.wait(); // Recursively check again
    }
    
    // Add this request to the queue
    this.requests.push(now);
  }
}

// Create a rate limiter for favorites API calls
const favoritesRateLimiter = new RateLimiter(3, 1000); // 3 requests per second


// Transform restaurant data to match frontend expectations
const transformRestaurant = (dbRestaurant) => {
  const logo = dbRestaurant.logoUrl || null;
  const logoUrl = logo ? buildImageUrl(logo) : null;
  
  return {
    ...dbRestaurant,
    logo: logoUrl,
    logoUrl: logoUrl,
    ...(Array.isArray(dbRestaurant.menuItems) && { menuItems: dbRestaurant.menuItems.map(normalizeMenuItem) })
  };
};

export const fetchRestaurants = async (filters = {}) => {
  try {
    const params = {};
    
    if (filters.featured !== undefined) {
      params.featured = filters.featured;
    }
    
    if (filters.search) {
      params.search = filters.search;
    }

    const response = await apiClient.get('/restaurants', params);
    
    // Transform each restaurant
    const transformedRestaurants = response.map(transformRestaurant);
    
    return transformedRestaurants;
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return [];
  }
};

export const fetchRestaurantById = async (id) => {
  try {
    const response = await apiClient.get(`/restaurants/${id}`);
    return transformRestaurant(response);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return null;
  }
};

export const fetchFeaturedRestaurants = async () => {
  try {
    const response = await apiClient.get('/restaurants/featured/list');
    
    // Transform each restaurant
    const transformedRestaurants = response.map(transformRestaurant);
    
    return transformedRestaurants;
  } catch (error) {
    console.error('Error fetching featured restaurants:', error);
    return [];
  }
};

export const fetchUserFavoriteRestaurants = async () => {
  try {
    const response = await apiClient.get('/favorites');
    
    // Transform each restaurant
    const transformedRestaurants = response.map(restaurant => ({
      ...transformRestaurant(restaurant),
      isFavorite: true,
      favoriteId: restaurant.favoriteId,
      favoritedAt: restaurant.favoritedAt
    }));
    
    return transformedRestaurants;
  } catch (error) {
    console.error('Error fetching favorite restaurants:', error);
    return [];
  }
};

export const fetchUserFavorites = async () => {
  try {
    const response = await apiClient.get('/favorites/ids');
    return response; // This returns just the restaurant IDs
  } catch (error) {
    console.error('Error fetching user favorites:', error);
    return [];
  }
};

export const addToFavorites = async (restaurantId) => {
  try {
    await favoritesRateLimiter.wait();
    
    const response = await apiClient.post(`/favorites/${restaurantId}`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return { success: false, error: error.message };
  }
};

export const removeFromFavorites = async (restaurantId) => {
  try {
    await favoritesRateLimiter.wait();
    
    await apiClient.delete(`/favorites/${restaurantId}`);
    return { success: true };
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return { success: false, error: error.message };
  }
};

export const checkIsFavorite = async (restaurantId) => {
  try {
    const favorites = await fetchUserFavorites();
    return favorites.includes(restaurantId);
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
};

export const toggleFavorite = async (restaurantId) => {
  try {
    await favoritesRateLimiter.wait();
    
    const response = await apiClient.post(`/favorites/${restaurantId}/toggle`);
    return { 
      success: true, 
      isFavorite: response.isFavorite,
      data: response.data 
    };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return { success: false, error: error.message };
  }
};

export const fetchRestaurantMenu = async (restaurantId, filters = {}) => {
  try {
    const params = {};
    
    if (filters.category) {
      params.category = filters.category;
    }
    
    if (filters.available !== undefined) {
      params.available = filters.available;
    }

    const response = await apiClient.get(`/restaurants/${restaurantId}/menu`, params);
    return (response || []).map(normalizeMenuItem);
  } catch (error) {
    console.error('Error fetching restaurant menu:', error);
    return [];
  }
}; 
import apiClient from '../lib/api';
import { buildImageUrl } from './imageService';

// ==================== ADMIN MENU ITEM SERVICES ====================

// Normalize menu item data to include proper image URLs
export const normalizeMenuItem = (item) => {
  const imageUrl = item.imageUrl || item.image;
  const image = imageUrl ? buildImageUrl(imageUrl) : null;
  
  return {
    ...item,
    image: image,
    imageUrl: image,
    price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
    labels: Array.isArray(item.labels) ? item.labels : (() => { 
      try { 
        return JSON.parse(item.labels || '[]'); 
      } catch { 
        return []; 
      } 
    })(),
  };
};

// Get all menu items for a restaurant (admin)
export const fetchRestaurantMenuItems = async (restaurantId, filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.category && filters.category !== 'all') {
      params.append('category', filters.category);
    }
    
    if (filters.available !== undefined) {
      params.append('available', filters.available);
    }
    
    if (filters.itemType && filters.itemType !== 'all') {
      params.append('itemType', filters.itemType);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    if (filters.limit) {
      params.append('limit', filters.limit);
    }
    
    if (filters.offset) {
      params.append('offset', filters.offset);
    }

    const response = await apiClient.get(`/admin/restaurants/${restaurantId}/menu-items?${params.toString()}`);
    
    // Normalize menu items to include proper image URLs
    const normalizedData = Array.isArray(response.data) 
      ? { ...response, data: response.data.map(normalizeMenuItem) }
      : response;
    
    return normalizedData;
  } catch (error) {
    console.error('Error fetching restaurant menu items:', error);
    throw error;
  }
};

// Get single menu item (admin)
export const fetchMenuItem = async (restaurantId, itemId) => {
  try {
    const response = await apiClient.get(`/admin/restaurants/${restaurantId}/menu-items/${itemId}`);
    return normalizeMenuItem(response);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    throw error;
  }
};

// Create new menu item (admin)
export const createMenuItem = async (restaurantId, menuItemData) => {
  try {
    const response = await apiClient.post(`/admin/restaurants/${restaurantId}/menu-items`, menuItemData);
    return normalizeMenuItem(response);
  } catch (error) {
    console.error('Error creating menu item:', error);
    throw error;
  }
};

// Update menu item (admin)
export const updateMenuItem = async (restaurantId, itemId, updateData) => {
  try {
    const response = await apiClient.put(`/admin/restaurants/${restaurantId}/menu-items/${itemId}`, updateData);
    return normalizeMenuItem(response);
  } catch (error) {
    console.error('Error updating menu item:', error);
    throw error;
  }
};

// Delete menu item (admin)
export const deleteMenuItem = async (restaurantId, itemId) => {
  try {
    const response = await apiClient.delete(`/admin/restaurants/${restaurantId}/menu-items/${itemId}`);
    return response;
  } catch (error) {
    console.error('Error deleting menu item:', error);
    throw error;
  }
};

// Bulk update menu items (admin)
export const bulkUpdateMenuItems = async (restaurantId, updates) => {
  try {
    const response = await apiClient.patch(`/admin/restaurants/${restaurantId}/menu-items/bulk`, { updates });
    
    // Normalize all updated menu items
    if (response.data && Array.isArray(response.data)) {
      return { ...response, data: response.data.map(normalizeMenuItem) };
    }
    
    return response;
  } catch (error) {
    console.error('Error bulk updating menu items:', error);
    throw error;
  }
};

// ==================== USER-FACING MENU SERVICES ====================

// Get restaurant menu items (user-facing)
export const fetchRestaurantMenu = async (restaurantId, filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.category && filters.category !== 'all') {
      params.append('category', filters.category);
    }
    
    if (filters.available !== undefined) {
      params.append('available', filters.available);
    }
    
    if (filters.itemType && filters.itemType !== 'all') {
      params.append('itemType', filters.itemType);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }

    const response = await apiClient.get(`/restaurants/${restaurantId}/menu?${params.toString()}`);
    return response;
  } catch (error) {
    console.error('Error fetching restaurant menu:', error);
    throw error;
  }
};

// Get menu categories for a restaurant
export const fetchMenuCategories = async (restaurantId) => {
  try {
    const response = await apiClient.get(`/restaurants/${restaurantId}/menu/categories`);
    return response;
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    throw error;
  }
};

// Get single menu item with full details (for item modals)
export const fetchMenuItemDetails = async (restaurantId, itemId) => {
  try {
    const response = await apiClient.get(`/restaurants/${restaurantId}/menu/${itemId}`);
    return response;
  } catch (error) {
    console.error('Error fetching menu item details:', error);
    throw error;
  }
};

// ==================== REAL-TIME UPDATES ====================

// Create SSE connection for admin menu updates
export const createMenuUpdatesStream = (onMessage, onError) => {
  const eventSource = new EventSource(`${import.meta.env.VITE_API_BASE_URL}/admin/menu-updates/stream`);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing SSE message:', error);
      if (onError) onError(error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (onError) onError(error);
  };
  
  return eventSource;
};

// Create SSE connection for public menu updates (user-facing)
export const createPublicMenuUpdatesStream = (restaurantId, onMessage, onError) => {
  const eventSource = new EventSource(`${import.meta.env.VITE_API_BASE_URL}/admin/public/menu-updates/stream?restaurantId=${restaurantId}`);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing SSE message:', error);
      if (onError) onError(error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (onError) onError(error);
  };
  
  return eventSource;
};

// ==================== MENU ITEM VALIDATION HELPERS ====================

// Validate menu item data based on type
export const validateMenuItemData = (data) => {
  const errors = [];
  
  // Common validation
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Item name is required');
  }
  
  if (!data.itemType || !['simple', 'variety', 'builder'].includes(data.itemType)) {
    errors.push('Valid item type is required (simple, variety, builder)');
  }
  
  if (typeof data.price !== 'number' || data.price < 0) {
    errors.push('Valid price is required');
  }
  
  if (!data.category || data.category.trim().length === 0) {
    errors.push('Category is required');
  }
  
  // Type-specific validation
  if (data.itemType === 'variety') {
    if (!data.options || !data.options.variants || !Array.isArray(data.options.variants)) {
      errors.push('Variants are required for variety items');
    } else if (data.options.variants.length === 0) {
      errors.push('At least one variant is required for variety items');
    } else {
      data.options.variants.forEach((variant, index) => {
        if (!variant.name || variant.name.trim().length === 0) {
          errors.push(`Variant ${index + 1} name is required`);
        }
        if (typeof variant.priceModifier !== 'number') {
          errors.push(`Variant ${index + 1} price modifier must be a number`);
        }
      });
    }
  }
  
  if (data.itemType === 'builder') {
    if (!data.options || !data.options.configurations || !Array.isArray(data.options.configurations)) {
      errors.push('Configurations are required for builder items');
    } else if (data.options.configurations.length === 0) {
      errors.push('At least one configuration category is required for builder items');
    } else {
      data.options.configurations.forEach((config, index) => {
        if (!config.category || config.category.trim().length === 0) {
          errors.push(`Configuration ${index + 1} category name is required`);
        }
        if (typeof config.required !== 'boolean') {
          errors.push(`Configuration ${index + 1} required field must be boolean`);
        }
        if (typeof config.maxSelections !== 'number' || config.maxSelections < 1) {
          errors.push(`Configuration ${index + 1} maxSelections must be a positive number`);
        }
        if (!config.options || !Array.isArray(config.options) || config.options.length === 0) {
          errors.push(`Configuration ${index + 1} must have at least one option`);
        } else {
          config.options.forEach((option, optIndex) => {
            if (!option.name || option.name.trim().length === 0) {
              errors.push(`Configuration ${index + 1}, option ${optIndex + 1} name is required`);
            }
            if (typeof option.priceModifier !== 'number') {
              errors.push(`Configuration ${index + 1}, option ${optIndex + 1} price modifier must be a number`);
            }
          });
        }
      });
    }
  }
  
  return errors;
};

// Normalize menu item data for API submission
export const normalizeMenuItemData = (data) => {
  // Convert labels to array if it's an object with numeric keys
  let normalizedLabels = [];
  if (data.labels) {
    if (Array.isArray(data.labels)) {
      normalizedLabels = data.labels;
    } else if (typeof data.labels === 'object') {
      // Convert object with numeric keys to array
      normalizedLabels = Object.values(data.labels);
    }
  }

  const normalized = {
    name: data.name?.trim(),
    description: data.description?.trim() || null,
    price: parseFloat(data.price),
    category: data.category?.trim(),
    imageUrl: data.imageUrl?.trim() || null,
    available: data.available !== false, // default to true
    itemType: data.itemType,
    options: data.options || null,
    labels: normalizedLabels
  };
  
  // Ensure options is properly structured for each type
  if (normalized.itemType === 'variety' && normalized.options) {
    normalized.options = {
      variants: normalized.options.variants || []
    };
  }
  
  if (normalized.itemType === 'builder' && normalized.options) {
    normalized.options = {
      configurations: normalized.options.configurations || []
    };
  }
  
  return normalized;
};

// ==================== PRICE CALCULATION HELPERS ====================

// Calculate final price for a variety item with selected variant
export const calculateVarietyItemPrice = (basePrice, variant) => {
  return basePrice + (variant?.priceModifier || 0);
};

// Calculate final price for a builder item with selected configurations
export const calculateBuilderItemPrice = (basePrice, selections) => {
  let totalPrice = basePrice;
  
  Object.values(selections).forEach(selectedOptions => {
    if (Array.isArray(selectedOptions)) {
      selectedOptions.forEach(option => {
        totalPrice += option.priceModifier || 0;
      });
    }
  });
  
  return totalPrice;
};

// Get price breakdown for builder items
export const getBuilderItemPriceBreakdown = (basePrice, selections) => {
  const breakdown = [
    { name: 'Base Price', price: basePrice }
  ];
  
  Object.entries(selections).forEach(([category, selectedOptions]) => {
    if (Array.isArray(selectedOptions)) {
      selectedOptions.forEach(option => {
        if (option.priceModifier > 0) {
          breakdown.push({
            name: `${category}: ${option.name}`,
            price: option.priceModifier
          });
        }
      });
    }
  });
  
  const total = breakdown.reduce((sum, item) => sum + item.price, 0);
  
  return {
    breakdown,
    total
  };
};

// ==================== MENU ITEM TYPE HELPERS ====================

// Get display name for item type
export const getItemTypeDisplayName = (itemType) => {
  const typeMap = {
    'simple': 'Regular Item',
    'variety': 'Variable Item',
    'builder': 'Configurable Item'
  };
  return typeMap[itemType] || 'Unknown Type';
};

// Check if item type requires options
export const requiresOptions = (itemType) => {
  return ['variety', 'builder'].includes(itemType);
};

// Get default options structure for item type
export const getDefaultOptions = (itemType) => {
  switch (itemType) {
    case 'variety':
      return {
        variants: []
      };
    case 'builder':
      return {
        configurations: []
      };
    default:
      return null;
  }
};

// ==================== CART INTEGRATION HELPERS ====================

// Create cart item from menu item with selections
export const createCartItem = (menuItem, selections = {}) => {
  const baseItem = {
    id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    menuItemId: menuItem.id,
    restaurantId: menuItem.restaurantId,
    name: menuItem.name,
    basePrice: menuItem.price,
    itemType: menuItem.itemType,
    imageUrl: menuItem.imageUrl,
    category: menuItem.category
  };

  if (menuItem.itemType === 'variety' && selections.selectedVariant) {
    const variant = selections.selectedVariant;
    return {
      ...baseItem,
      totalPrice: calculateVarietyItemPrice(menuItem.price, variant),
      selectedVariant: {
        id: variant.id,
        name: variant.name,
        imageUrl: variant.imageUrl,
        priceModifier: variant.priceModifier
      }
    };
  }

  if (menuItem.itemType === 'builder' && selections.configurations) {
    const totalPrice = calculateBuilderItemPrice(menuItem.price, selections.configurations);
    return {
      ...baseItem,
      totalPrice,
      selections: selections.configurations
    };
  }

  // Simple item
  return {
    ...baseItem,
    totalPrice: menuItem.price
  };
};

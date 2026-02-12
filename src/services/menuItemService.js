import apiClient from '../lib/api';
import { buildImageUrl } from './imageService';


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
    
    const normalizedData = Array.isArray(response.data) 
      ? { ...response, data: response.data.map(normalizeMenuItem) }
      : response;
    
    return normalizedData;
  } catch (error) {
    console.error('Error fetching restaurant menu items:', error);
    throw error;
  }
};

export const fetchMenuItem = async (restaurantId, itemId) => {
  try {
    const response = await apiClient.get(`/admin/restaurants/${restaurantId}/menu-items/${itemId}`);
    return normalizeMenuItem(response);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    throw error;
  }
};

export const createMenuItem = async (restaurantId, menuItemData) => {
  try {
    const response = await apiClient.post(`/admin/restaurants/${restaurantId}/menu-items`, menuItemData);
    return normalizeMenuItem(response);
  } catch (error) {
    console.error('Error creating menu item:', error);
    throw error;
  }
};

export const updateMenuItem = async (restaurantId, itemId, updateData) => {
  try {
    const response = await apiClient.put(`/admin/restaurants/${restaurantId}/menu-items/${itemId}`, updateData);
    return normalizeMenuItem(response);
  } catch (error) {
    console.error('Error updating menu item:', error);
    throw error;
  }
};

export const deleteMenuItem = async (restaurantId, itemId) => {
  try {
    const response = await apiClient.delete(`/admin/restaurants/${restaurantId}/menu-items/${itemId}`);
    return response;
  } catch (error) {
    console.error('Error deleting menu item:', error);
    throw error;
  }
};

export const duplicateMenuItem = async (restaurantId, itemId) => {
  try {
    const response = await apiClient.post(`/admin/restaurants/${restaurantId}/menu-items/${itemId}/duplicate`);
    const data = response?.data ?? response;
    return data ? normalizeMenuItem(data) : response;
  } catch (error) {
    console.error('Error duplicating menu item:', error);
    throw error;
  }
};

export const bulkUpdateMenuItems = async (restaurantId, updates) => {
  try {
    const response = await apiClient.patch(`/admin/restaurants/${restaurantId}/menu-items/bulk`, { updates });
    
    if (response.data && Array.isArray(response.data)) {
      return { ...response, data: response.data.map(normalizeMenuItem) };
    }
    
    return response;
  } catch (error) {
    console.error('Error bulk updating menu items:', error);
    throw error;
  }
};

export const fetchMenuCategories = async (restaurantId) => {
  try {
    const response = await apiClient.get(`/restaurants/${restaurantId}/menu/categories`);
    return response;
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    throw error;
  }
};

export const fetchMenuItemDetails = async (restaurantId, itemId) => {
  try {
    const response = await apiClient.get(`/restaurants/${restaurantId}/menu/${itemId}`);
    return response;
  } catch (error) {
    console.error('Error fetching menu item details:', error);
    throw error;
  }
};


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


export const validateMenuItemData = (data) => {
  const errors = [];
  
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

export const normalizeMenuItemData = (data) => {
  let normalizedLabels = [];
  if (data.labels) {
    if (Array.isArray(data.labels)) {
      normalizedLabels = data.labels;
    } else if (typeof data.labels === 'object') {
      normalizedLabels = Object.values(data.labels);
    }
  }

  const normalized = {
    name: data.name?.trim(),
    description: data.description?.trim() || null,
    price: parseFloat(data.price),
    category: data.category?.trim(),
    imageUrl: data.imageUrl?.trim() || null,
    available: data.available !== false,
    itemType: data.itemType,
    options: data.options || null,
    labels: normalizedLabels
  };
  
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


export const calculateVarietyItemPrice = (basePrice, variant) => {
  return basePrice + (variant?.priceModifier || 0);
};

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


export const getItemTypeDisplayName = (itemType) => {
  const typeMap = {
    'simple': 'Regular Item',
    'variety': 'Variable Item',
    'builder': 'Configurable Item'
  };
  return typeMap[itemType] || 'Unknown Type';
};

export const requiresOptions = (itemType) => {
  return ['variety', 'builder'].includes(itemType);
};

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

  return {
    ...baseItem,
    totalPrice: menuItem.price
  };
};

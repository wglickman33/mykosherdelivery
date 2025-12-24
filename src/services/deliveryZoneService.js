import apiClient from '../lib/api';
import logger from '../utils/logger';
import { calculateTaxWithStripe, getTaxRateFromStripe } from './stripeTaxService';

// Cache for delivery zones to avoid repeated API calls
let deliveryZonesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all delivery zones from the backend
 * @returns {Promise<Array>} Array of delivery zone objects
 */
export const fetchDeliveryZones = async () => {
  try {
    // Check if we have valid cached data
    if (deliveryZonesCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      return { success: true, data: deliveryZonesCache };
    }

    const response = await apiClient.get('/admin/delivery-zones');
    
    if (response && Array.isArray(response)) {
      deliveryZonesCache = response;
      cacheTimestamp = Date.now();
      return { success: true, data: response };
    }
    
    return { success: false, error: 'Invalid response format' };
  } catch (error) {
    logger.error('Error fetching delivery zones:', error);
    // If it's an authentication error, return success: false without logging as error
    if (error.message?.includes('Access token required') || error.message?.includes('authentication')) {
      return { success: false, error: 'Authentication required' };
    }
    return { success: false, error: error.message };
  }
};

/**
 * Get delivery zone information for a specific zip code
 * @param {string} zipCode - The zip code to look up
 * @returns {Promise<Object|null>} Delivery zone info or null if not found
 */
export const getDeliveryZoneByZipCode = async (zipCode) => {
  try {
    if (!zipCode) return null;
    
    const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
    
    const result = await fetchDeliveryZones();
    if (!result.success) {
      logger.warn('Failed to fetch delivery zones, falling back to static data');
      return null;
    }
    
    const deliveryZones = result.data;
    const zone = deliveryZones.find(z => z.zipCode === cleanZip && z.available);
    
    if (zone) {
      return {
        id: zone.id,
        zipCode: zone.zipCode,
        city: zone.city,
        state: zone.state,
        deliveryFee: parseFloat(zone.deliveryFee),
        available: zone.available
      };
    }
    
    return null;
  } catch (error) {
    // Don't log authentication errors as errors, they're expected for unauthenticated users
    if (error.message?.includes('Access token required') || error.message?.includes('authentication')) {
      return null;
    }
    logger.error('Error getting delivery zone by zip code:', error);
    return null;
  }
};

/**
 * Validate if a zip code is in a valid delivery zone
 * @param {string} zipCode - The zip code to validate
 * @returns {Promise<boolean>} True if zip code is valid for delivery
 */
export const isValidDeliveryZipCode = async (zipCode) => {
  try {
    const zone = await getDeliveryZoneByZipCode(zipCode);
    return zone !== null;
  } catch (error) {
    // Don't log authentication errors as errors, they're expected for unauthenticated users
    if (error.message?.includes('Access token required') || error.message?.includes('authentication')) {
      return false;
    }
    logger.error('Error validating delivery zip code:', error);
    return false;
  }
};

/**
 * Get all valid zip codes for delivery
 * @returns {Promise<Set>} Set of valid zip codes
 */
export const getValidZipCodes = async () => {
  try {
    const result = await fetchDeliveryZones();
    if (!result.success) {
      return new Set();
    }
    
    const validZips = new Set();
    result.data.forEach(zone => {
      if (zone.available) {
        validZips.add(zone.zipCode);
      }
    });
    
    return validZips;
  } catch (error) {
    logger.error('Error getting valid zip codes:', error);
    return new Set();
  }
};

/**
 * Calculate delivery fee for a zip code
 * @param {string} zipCode - The zip code
 * @returns {Promise<number>} Delivery fee amount
 */
export const calculateDeliveryFee = async (zipCode) => {
  try {
    if (!zipCode) {
      return 5.99; // Default fallback
    }
    
    // First try to get from API
    const zone = await getDeliveryZoneByZipCode(zipCode);
    if (zone && zone.deliveryFee) {
      return zone.deliveryFee;
    }
    
    // Fallback to static data if API fails
    const { DELIVERY_ZONES } = await import('../data/deliveryZones');
    const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
    
    // Check each zone for the zip code
    for (const zoneKey in DELIVERY_ZONES) {
      const zone = DELIVERY_ZONES[zoneKey];
      if (zone.zipCodes && zone.zipCodes.includes(cleanZip)) {
        return zone.deliveryFee || 5.99;
      }
    }
    
    // Default fallback
    return 5.99;
  } catch (error) {
    logger.error('Error calculating delivery fee:', error);
    // Fallback to static data on error
    try {
      const { DELIVERY_ZONES } = await import('../data/deliveryZones');
      const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
      for (const zoneKey in DELIVERY_ZONES) {
        const zone = DELIVERY_ZONES[zoneKey];
        if (zone.zipCodes && zone.zipCodes.includes(cleanZip)) {
          return zone.deliveryFee || 5.99;
        }
      }
    } catch (importError) {
      logger.error('Error importing delivery zones:', importError);
    }
    return 5.99; // Final fallback
  }
};

/**
 * Calculate tax rate for a zip code using Stripe Tax
 * @param {string} zipCode - The zip code
 * @param {Array} items - Optional items array for accurate tax calculation
 * @param {Object} address - Optional full address object
 * @returns {Promise<number>} Tax rate (e.g., 0.0825 for 8.25%)
 */
export const calculateTaxRate = async (zipCode, items = null, address = null) => {
  try {
    const zone = await getDeliveryZoneByZipCode(zipCode);
    if (!zone) {
      return 0.0825; // Default fallback if zone not found
    }

    // If items and address are provided, use Stripe Tax for accurate calculation
    if (items && items.length > 0 && address) {
      try {
        const taxResult = await calculateTaxWithStripe({
          items: items.map(item => ({
            amount: item.price * (item.quantity || 1),
            description: item.name || 'Item',
            id: item.id,
          })),
          customerAddress: {
            city: zone.city || address.city,
            state: zone.state || address.state,
            postal_code: zipCode,
            country: 'US',
          },
          deliveryFee: 0, // Don't include delivery fee in tax rate calculation
        });

        if (taxResult.success && taxResult.taxAmount > 0) {
          const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
          return getTaxRateFromStripe(taxResult, subtotal);
        }
      } catch (stripeError) {
        logger.warn('Stripe Tax calculation failed, using default rate:', stripeError);
      }
    }

    // Fallback to default NY tax rate
    return 0.0825;
  } catch (error) {
    logger.error('Error calculating tax rate:', error);
    return 0.0825; // Default fallback
  }
};

/**
 * Clear the delivery zones cache (useful for testing or when data changes)
 */
export const clearDeliveryZonesCache = () => {
  deliveryZonesCache = null;
  cacheTimestamp = null;
};

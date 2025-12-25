import apiClient from '../lib/api';
import logger from '../utils/logger';
import { calculateTaxWithStripe, getTaxRateFromStripe } from './stripeTaxService';

let deliveryZonesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;


export const fetchDeliveryZones = async () => {
  try {
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
    if (error.message?.includes('Access token required') || error.message?.includes('authentication')) {
      return { success: false, error: 'Authentication required' };
    }
    return { success: false, error: error.message };
  }
};


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
    if (error.message?.includes('Access token required') || error.message?.includes('authentication')) {
      return null;
    }
    logger.error('Error getting delivery zone by zip code:', error);
    return null;
  }
};


export const isValidDeliveryZipCode = async (zipCode) => {
  try {
    const zone = await getDeliveryZoneByZipCode(zipCode);
    return zone !== null;
  } catch (error) {
    if (error.message?.includes('Access token required') || error.message?.includes('authentication')) {
      return false;
    }
    logger.error('Error validating delivery zip code:', error);
    return false;
  }
};


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


export const calculateDeliveryFee = async (zipCode) => {
  try {
    if (!zipCode) {
      return 5.99;
    }
    
    const zone = await getDeliveryZoneByZipCode(zipCode);
    if (zone && zone.deliveryFee) {
      return zone.deliveryFee;
    }
    
    const { DELIVERY_ZONES } = await import('../data/deliveryZones');
    const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
    
    for (const zoneKey in DELIVERY_ZONES) {
      const zone = DELIVERY_ZONES[zoneKey];
      if (zone.zipCodes && zone.zipCodes.includes(cleanZip)) {
        return zone.deliveryFee || 5.99;
      }
    }
    
    return 5.99;
  } catch (error) {
    logger.error('Error calculating delivery fee:', error);
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
    return 5.99;
  }
};


export const calculateTaxRate = async (zipCode, items = null, address = null) => {
  try {
    const zone = await getDeliveryZoneByZipCode(zipCode);
    if (!zone) {
      return 0.0825;
    }

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
          deliveryFee: 0,
        });

        if (taxResult.success && taxResult.taxAmount > 0) {
          const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
          return getTaxRateFromStripe(taxResult, subtotal);
        }
      } catch (stripeError) {
        logger.warn('Stripe Tax calculation failed, using default rate:', stripeError);
      }
    }

    return 0.0825;
  } catch (error) {
    logger.error('Error calculating tax rate:', error);
    return 0.0825;
  }
};


export const clearDeliveryZonesCache = () => {
  deliveryZonesCache = null;
  cacheTimestamp = null;
};

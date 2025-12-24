import { validateAddressWithGeocoding } from '../data/deliveryZones';
import { isValidDeliveryZipCode, getDeliveryZoneByZipCode } from './deliveryZoneService';
import logger from '../utils/logger';

/**
 * Enhanced address validation that uses backend delivery zones
 * Falls back to static data if backend is unavailable
 */
export const validateDeliveryAddress = async (address) => {
  try {
    if (!address || typeof address !== 'string') {
      return {
        isValid: false,
        error: 'Please enter a complete address',
        zipCode: null,
        zone: null,
        coordinates: null,
        formattedAddress: null
      };
    }

    // First, try to validate using Google Geocoding API
    const geocodingResult = await validateAddressWithGeocoding(address);
    
    if (!geocodingResult.isValid) {
      return geocodingResult;
    }

    // If we have a zip code, validate it against backend delivery zones
    if (geocodingResult.zipCode) {
      try {
        const isValidZip = await isValidDeliveryZipCode(geocodingResult.zipCode);
        const zoneInfo = await getDeliveryZoneByZipCode(geocodingResult.zipCode);
        
        if (!isValidZip || !zoneInfo) {
          // If backend validation fails, fall back to static validation
          const { isValidZipCode: staticIsValid, getDeliveryZoneInfo } = await import('../data/deliveryZones');
          
          if (staticIsValid(geocodingResult.zipCode)) {
            const staticZoneInfo = getDeliveryZoneInfo(geocodingResult.zipCode);
            return {
              isValid: true,
              error: null,
              zipCode: geocodingResult.zipCode,
              zone: staticZoneInfo,
              coordinates: geocodingResult.coordinates,
              formattedAddress: geocodingResult.formattedAddress
            };
          }
          
          return {
            isValid: false,
            error: 'Sorry, we don\'t deliver to this area yet. Please try a different address.',
            zipCode: geocodingResult.zipCode,
            zone: null,
            coordinates: geocodingResult.coordinates,
            formattedAddress: geocodingResult.formattedAddress
          };
        }

        return {
          isValid: true,
          error: null,
          zipCode: geocodingResult.zipCode,
          zone: zoneInfo,
          coordinates: geocodingResult.coordinates,
          formattedAddress: geocodingResult.formattedAddress
        };
      } catch (backendError) {
        logger.warn('Backend delivery zone validation failed, falling back to static validation:', backendError);
        
        // Fall back to static validation if backend fails
        try {
          const { isValidZipCode: staticIsValid, getDeliveryZoneInfo } = await import('../data/deliveryZones');
          
          if (staticIsValid(geocodingResult.zipCode)) {
            const staticZoneInfo = getDeliveryZoneInfo(geocodingResult.zipCode);
            return {
              isValid: true,
              error: null,
              zipCode: geocodingResult.zipCode,
              zone: staticZoneInfo,
              coordinates: geocodingResult.coordinates,
              formattedAddress: geocodingResult.formattedAddress
            };
          }
        } catch (staticError) {
          logger.error('Static validation also failed:', staticError);
        }
        
        // If both backend and static validation fail, return the geocoding result
        return geocodingResult;
      }
    }

    // If no zip code but coordinates are valid, return the geocoding result
    return geocodingResult;

  } catch (error) {
    logger.error('Error validating delivery address:', error);
    return {
      isValid: false,
      error: 'Unable to validate address. Please try again.',
      zipCode: null,
      zone: null,
      coordinates: null,
      formattedAddress: null
    };
  }
};

/**
 * Validate a zip code against backend delivery zones
 * @param {string} zipCode - The zip code to validate
 * @returns {Promise<Object>} Validation result with zone info
 */
export const validateZipCode = async (zipCode) => {
  try {
    if (!zipCode) {
      return {
        isValid: false,
        error: 'Please enter a zip code',
        zipCode: null,
        zone: null
      };
    }

    const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
    
    const isValidZip = await isValidDeliveryZipCode(cleanZip);
    const zoneInfo = await getDeliveryZoneByZipCode(cleanZip);
    
    if (!isValidZip || !zoneInfo) {
      return {
        isValid: false,
        error: 'Sorry, we don\'t deliver to this area yet. Please try a different zip code.',
        zipCode: cleanZip,
        zone: null
      };
    }

    return {
      isValid: true,
      error: null,
      zipCode: cleanZip,
      zone: zoneInfo
    };

  } catch (error) {
    logger.error('Error validating zip code:', error);
    return {
      isValid: false,
      error: 'Unable to validate zip code. Please try again.',
      zipCode: null,
      zone: null
    };
  }
};

/**
 * Extract zip code from address string
 * @param {string} address - The address string
 * @returns {string|null} Extracted zip code or null
 */
export const extractZipCode = (address) => {
  if (!address) return null;
  
  // Look for 5-digit zip code pattern
  const zipMatch = address.match(/\b\d{5}\b/);
  return zipMatch ? zipMatch[0] : null;
};

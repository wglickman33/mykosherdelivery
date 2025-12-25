import { validateAddressWithGeocoding } from '../data/deliveryZones';
import { isValidDeliveryZipCode, getDeliveryZoneByZipCode } from './deliveryZoneService';
import logger from '../utils/logger';


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

    const geocodingResult = await validateAddressWithGeocoding(address);
    
    if (!geocodingResult.isValid) {
      return geocodingResult;
    }

    if (geocodingResult.zipCode) {
      try {
        const isValidZip = await isValidDeliveryZipCode(geocodingResult.zipCode);
        const zoneInfo = await getDeliveryZoneByZipCode(geocodingResult.zipCode);
        
        if (!isValidZip || !zoneInfo) {
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
        
        return geocodingResult;
      }
    }

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


export const extractZipCode = (address) => {
  if (!address) return null;
  
  const zipMatch = address.match(/\b\d{5}\b/);
  return zipMatch ? zipMatch[0] : null;
};

const { DeliveryZone } = require('../models');
const logger = require('../utils/logger');

const validateDeliveryZipCode = async (zipCode) => {
  try {
    if (!zipCode) {
      return {
        isValid: false,
        zone: null,
        error: 'Zip code is required'
      };
    }

    const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
    
    if (!/^\d{5}$/.test(cleanZip)) {
      return {
        isValid: false,
        zone: null,
        error: 'Invalid zip code format'
      };
    }

    const zone = await DeliveryZone.findOne({
      where: {
        zipCode: cleanZip,
        available: true
      }
    });

    if (!zone) {
      logger.warn('Order attempted with invalid delivery zip code', {
        zipCode: cleanZip
      });
      return {
        isValid: false,
        zone: null,
        error: 'Sorry, we don\'t deliver to this area yet. Please try a different address.'
      };
    }

    return {
      isValid: true,
      zone: zone.toJSON(),
      error: null
    };
  } catch (error) {
    logger.error('Error validating delivery zip code:', error);
    return {
      isValid: false,
      zone: null,
      error: 'Unable to validate delivery address. Please try again.'
    };
  }
};

const validateDeliveryAddress = async (deliveryAddress) => {
  try {
    if (!deliveryAddress) {
      return {
        isValid: false,
        zone: null,
        error: 'Delivery address is required'
      };
    }

    const zipCode = deliveryAddress.zip_code || 
                    deliveryAddress.zipCode || 
                    deliveryAddress.postal_code ||
                    deliveryAddress.zip ||
                    null;

    if (!zipCode) {
      return {
        isValid: false,
        zone: null,
        error: 'Zip code is required in delivery address'
      };
    }

    return await validateDeliveryZipCode(zipCode);
  } catch (error) {
    logger.error('Error validating delivery address:', error);
    return {
      isValid: false,
      zone: null,
      error: 'Unable to validate delivery address. Please try again.'
    };
  }
};

module.exports = {
  validateDeliveryZipCode,
  validateDeliveryAddress
};

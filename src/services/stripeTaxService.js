import apiClient from '../lib/api';
import logger from '../utils/logger';

/**
 * Calculate tax using Stripe Tax API
 * @param {Object} params - Tax calculation parameters
 * @param {Array} params.items - Array of items with amount and description
 * @param {Object} params.customerAddress - Customer delivery address
 * @param {number} params.deliveryFee - Delivery fee amount
 * @param {string} params.currency - Currency code (default: 'usd')
 * @returns {Promise<Object>} Tax calculation result
 */
export const calculateTaxWithStripe = async ({
  items,
  customerAddress,
  deliveryFee = 0,
  currency = 'usd',
}) => {
  try {
    if (!items || items.length === 0) {
      throw new Error('Items array is required');
    }

    if (!customerAddress) {
      throw new Error('Customer address is required');
    }

    // Prepare items for Stripe Tax API
    const stripeItems = items.map((item) => ({
      amount: item.amount || item.price * (item.quantity || 1),
      description: item.description || item.name || 'Item',
      id: item.id,
    }));

    // Prepare customer address
    const customer = {
      address: {
        line1: customerAddress.line1 || customerAddress.street || customerAddress.address,
        city: customerAddress.city,
        state: customerAddress.state,
        postal_code: customerAddress.postal_code || customerAddress.zipCode || customerAddress.zip,
        country: customerAddress.country || 'US',
      },
    };

    // Prepare shipping cost if delivery fee exists
    const shipping = deliveryFee > 0 ? {
      amount: deliveryFee,
    } : null;

    const payload = {
      items: stripeItems,
      currency,
      customer,
      ...(shipping && { shipping }),
    };

    logger.debug('Sending tax calculation request:', {
      itemCount: stripeItems.length,
      hasShipping: !!shipping,
      customerCity: customer.address.city,
    });

    const response = await apiClient.post('/tax/calculate', payload);

    if (response.success && response.data) {
      return {
        success: true,
        subtotal: response.data.subtotal,
        taxAmount: response.data.taxAmount,
        totalAmount: response.data.totalAmount,
        taxBreakdown: response.data.taxBreakdown || [],
        calculationId: response.data.calculationId,
      };
    }

    throw new Error(response.error || 'Failed to calculate tax');
  } catch (error) {
    logger.error('Error calculating tax with Stripe:', error);
    return {
      success: false,
      error: error.message || 'Failed to calculate tax',
      // Fallback to zero tax if calculation fails
      subtotal: items.reduce((sum, item) => sum + (item.amount || item.price * (item.quantity || 1)), 0),
      taxAmount: 0,
      totalAmount: items.reduce((sum, item) => sum + (item.amount || item.price * (item.quantity || 1)), 0) + deliveryFee,
      taxBreakdown: [],
    };
  }
};

/**
 * Calculate tax rate from Stripe Tax calculation
 * @param {Object} taxResult - Result from calculateTaxWithStripe
 * @param {number} subtotal - Subtotal amount
 * @returns {number} Tax rate as decimal (e.g., 0.0825 for 8.25%)
 */
export const getTaxRateFromStripe = (taxResult, subtotal) => {
  if (!taxResult.success || !taxResult.taxAmount || subtotal === 0) {
    return 0;
  }
  return taxResult.taxAmount / subtotal;
};


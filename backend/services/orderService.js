const crypto = require('crypto');
const logger = require('../utils/logger');

const generateOrderNumber = (prefix = 'MKD') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const calculateTotals = (items, options = {}) => {
  const {
    taxRate = 0.0825,
    deliveryFee = 0,
    tip = 0,
    discountAmount = 0
  } = options;

  let subtotal = 0;
  let totalMeals = 0;

  if (Array.isArray(items)) {
    items.forEach(item => {
      const itemPrice = parseFloat(item.price || 0);
      const itemQuantity = parseInt(item.quantity || 1, 10);
      subtotal += itemPrice * itemQuantity;
      totalMeals += itemQuantity;
    });
  } else if (typeof items === 'object') {
    Object.values(items).forEach(item => {
      const itemPrice = parseFloat(item.price || 0);
      const itemQuantity = parseInt(item.quantity || 1, 10);
      subtotal += itemPrice * itemQuantity;
      totalMeals += itemQuantity;
    });
  }

  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const tax = subtotalAfterDiscount * taxRate;
  const total = subtotalAfterDiscount + deliveryFee + tip + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    tip: Math.round(tip * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    totalMeals
  };
};

const calculateResidentOrderTotals = (meals, taxRate = 0.0825) => {
  let subtotal = 0;
  let totalMeals = 0;

  meals.forEach(meal => {
    if (meal.items && Array.isArray(meal.items)) {
      meal.items.forEach(item => {
        const price = parseFloat(item.price || 0);
        const quantity = parseInt(item.quantity || 1, 10);
        subtotal += price * quantity;
        totalMeals += quantity;
      });
    }
  });

  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
    totalMeals
  };
};

const validateOrderData = (orderData, schema) => {
  const errors = [];

  if (schema.requiredFields) {
    schema.requiredFields.forEach(field => {
      if (!orderData[field]) {
        errors.push(`${field} is required`);
      }
    });
  }

  if (schema.numericFields) {
    schema.numericFields.forEach(field => {
      if (orderData[field] !== undefined && isNaN(parseFloat(orderData[field]))) {
        errors.push(`${field} must be a number`);
      }
    });
  }

  if (schema.positiveFields) {
    schema.positiveFields.forEach(field => {
      if (orderData[field] !== undefined && parseFloat(orderData[field]) < 0) {
        errors.push(`${field} must be positive`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const updateOrderStatus = async (Order, orderId, status, userId = null) => {
  try {
    const order = await Order.findByPk(orderId);
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (userId && order.userId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    order.status = status;
    await order.save();

    logger.info('Order status updated', {
      orderId,
      newStatus: status,
      previousStatus: order.status
    });

    return { success: true, order };
  } catch (error) {
    logger.error('Error updating order status:', error);
    return { success: false, error: error.message };
  }
};

const formatOrderNumber = (orderNumber) => {
  if (!orderNumber) return 'N/A';
  return orderNumber.toString().toUpperCase();
};

const parseOrderItems = (items) => {
  if (Array.isArray(items)) {
    return items;
  }
  
  if (typeof items === 'object' && items !== null) {
    return Object.values(items);
  }
  
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch {
    return [];
  }
};

module.exports = {
  generateOrderNumber,
  calculateTotals,
  calculateResidentOrderTotals,
  validateOrderData,
  updateOrderStatus,
  formatOrderNumber,
  parseOrderItems
};

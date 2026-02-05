const logger = require('../utils/logger');
const axios = require('axios');

const SHIPDAY_API_KEY = process.env.SHIPDAY_API_KEY;
const SHIPDAY_BASE_URL = process.env.SHIPDAY_BASE_URL || 'https://api.shipday.com';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      logger.warn(`Shipday API call failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, errorMessage);
      await sleep(delay);
    }
  }
};

const mapOrderToShipdayFormat = (order) => {
  try {
    const orderData = order.toJSON ? order.toJSON() : order;
    const customer = orderData.user || {};

    let customerName = 'Customer';
    if (customer.firstName && customer.lastName) {
      customerName = `${customer.firstName} ${customer.lastName}`.trim();
    } else if (customer.firstName) {
      customerName = customer.firstName;
    } else if (customer.first_name && customer.last_name) {
      customerName = `${customer.first_name} ${customer.last_name}`.trim();
    } else if (customer.first_name) {
      customerName = customer.first_name;
    } else if (customer.name) {
      customerName = customer.name;
    }
    
    const deliveryAddress = orderData.deliveryAddress || {};
    const addressLine1 = deliveryAddress.address || deliveryAddress.street || deliveryAddress.addressLine1 || '';
    const addressLine2 = deliveryAddress.addressLine2 || deliveryAddress.apt || deliveryAddress.unit || '';
    const city = deliveryAddress.city || '';
    const state = deliveryAddress.state || '';
    const zipCode = deliveryAddress.zipCode || deliveryAddress.zip || deliveryAddress.postalCode || '';
    let phoneNumber = customer.phone || customer.phoneNumber || deliveryAddress.phone || '';
    phoneNumber = phoneNumber.replace(/\D/g, '');
    
    const email = customer.email || '';
    let orderItems = [];
    
    if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
      Object.values(orderData.restaurantGroups).forEach((group) => {
        const items = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
        items.forEach(item => {
          orderItems.push({
            name: item.name || item.title || 'Item',
            quantity: item.quantity || 1,
            price: parseFloat(item.price || 0),
            specialInstructions: item.specialInstructions || item.notes || ''
          });
        });
      });
    } else if (Array.isArray(orderData.items)) {
      orderItems = orderData.items.map(item => ({
        name: item.name || item.title || 'Item',
        quantity: item.quantity || 1,
        price: parseFloat(item.price || 0),
        specialInstructions: item.specialInstructions || item.notes || ''
      }));
    }
    
    const orderNotes = [
      orderData.deliveryInstructions,
      orderData.appliedPromo ? `Promo Code: ${orderData.appliedPromo.code || ''}` : null
    ].filter(Boolean).join(' | ');
    
    const orderPlacedTime = orderData.createdAt || orderData.created_at || new Date();
    const orderDate = new Date(orderPlacedTime);
    
    const estFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const estParts = estFormatter.formatToParts(orderDate);
    const estObj = {};
    estParts.forEach(part => { estObj[part.type] = part.value; });
    
    const month = parseInt(estObj.month);
    const day = parseInt(estObj.day);
    const year = parseInt(estObj.year);
    let offsetHours = -5;
    
    if (month >= 4 && month <= 10) {
      offsetHours = -4;
    } else if (month === 3) {
      const firstOfMarch = new Date(year, 2, 1);
      const firstSunday = 1 + (7 - firstOfMarch.getDay()) % 7;
      const secondSunday = firstSunday + 7;
      if (day >= secondSunday) offsetHours = -4;
    } else if (month === 11) {
      const firstOfNovember = new Date(year, 10, 1);
      const firstSunday = 1 + (7 - firstOfNovember.getDay()) % 7;
      if (day < firstSunday) offsetHours = -4;
    }
    
    const offsetStr = `${offsetHours >= 0 ? '+' : ''}${String(offsetHours).padStart(2, '0')}:00`;
    
    const orderPlacedISO = `${estObj.year}-${estObj.month}-${estObj.day}T${estObj.hour}:${estObj.minute}:${estObj.second}${offsetStr}`;
    
    if (!customerName || customerName.trim() === '' || customerName === 'Customer') {
      customerName = `Customer ${orderData.orderNumber}`;
    }
    customerName = String(customerName).trim();
    if (!customerName || customerName === '') {
      customerName = `Customer ${orderData.orderNumber}`;
    }
    
    if (!phoneNumber || phoneNumber.trim() === '') {
      phoneNumber = '0000000000';
    }
    phoneNumber = String(phoneNumber).trim();
    
    if (!addressLine1 || !city || !state || !zipCode) {
      throw new Error(`Missing required delivery address fields: street=${!!addressLine1}, city=${!!city}, state=${!!state}, zip=${!!zipCode}`);
    }
    
    let fullAddress = addressLine1;
    if (addressLine2) {
      fullAddress += `, ${addressLine2}`;
    }
    fullAddress += `, ${city}, ${state} ${zipCode}, USA`;
    
    const shipdayOrder = {
      orderNumber: orderData.orderNumber,
      customerName: customerName,
      customerPhoneNumber: phoneNumber,
      customerEmail: email || undefined,
      customerAddress: fullAddress,
      items: orderItems.map(item => ({
        name: item.name,
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.price || 0)
      })),
      totalOrderCost: parseFloat(orderData.total || 0),
      tips: parseFloat(orderData.tip || 0) || undefined,
      specialInstructions: orderNotes || undefined,
      orderPlaced: orderPlacedISO || undefined
    };
    
    Object.keys(shipdayOrder).forEach(key => {
      if (shipdayOrder[key] === undefined) {
        delete shipdayOrder[key];
      }
    });
    
    return shipdayOrder;
  } catch (error) {
    logger.error('Error mapping order to Shipday format:', error);
    throw new Error(`Failed to map order to Shipday format: ${error.message}`);
  }
};


const sendOrderToShipday = async (order) => {
  if (!SHIPDAY_API_KEY) {
    logger.warn('Shipday API key not configured, skipping order send');
    return { success: false, error: 'Shipday API key not configured' };
  }
  
  try {
    const shipdayOrder = mapOrderToShipdayFormat(order);
    
    let response;
    let responseData;
    let shipdayOrderId = null;
    
    try {
      response = await retryWithBackoff(async () => {
        const apiResponse = await axios.post(`${SHIPDAY_BASE_URL}/orders`, shipdayOrder, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${SHIPDAY_API_KEY}`,
            'Accept': 'application/json'
          }
        });
        return apiResponse;
      });
      
      responseData = response.data;
      
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && responseData.success === false) {
        const errorMessage = responseData.response || responseData.message || responseData.error || 'Shipday insert failed';
        logger.error('Shipday API returned error:', {
          orderId: order.id || order.orderId,
          orderNumber: order.orderNumber,
          error: errorMessage
        });
        return { 
          success: false, 
          error: errorMessage, 
          responseData: responseData
        };
      }
      
      if (typeof responseData === 'string') {
        const idMatch = responseData.match(/\bid\s+(\d+)\b/i);
        if (idMatch && idMatch[1]) {
          shipdayOrderId = idMatch[1];
        } else {
          return { 
            success: false, 
            error: 'Shipday response missing orderId (string response could not be parsed)', 
            responseData: responseData
          };
        }
      } else {
        shipdayOrderId = responseData?.id || responseData?.orderId || responseData?.data?.id || responseData?.data?.orderId;
      }
      
      if (!shipdayOrderId) {
        logger.error('Shipday API response missing order ID:', {
          orderId: order.id || order.orderId,
          orderNumber: order.orderNumber,
          responseData: responseData
        });
        return { 
          success: false, 
          error: 'Shipday response missing orderId', 
          responseData: responseData
        };
      }
      
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && 'success' in responseData && responseData.success === false) {
        return { 
          success: false, 
          error: responseData.response || 'Shipday insert failed despite returning orderId', 
          responseData: responseData,
          shipdayOrderId: shipdayOrderId
        };
      }
    } catch (apiError) {
      logger.error('Shipday API call failed:', {
        orderId: order.id || order.orderId,
        orderNumber: order.orderNumber,
        error: apiError.message,
        response: apiError.response?.data
      });
      throw apiError;
    }
    
    logger.info('Order sent to Shipday successfully', {
      orderId: order.id || order.orderId,
      orderNumber: order.orderNumber,
      shipdayOrderId: shipdayOrderId
    });
    
    return {
      success: true,
      shipdayOrderId: shipdayOrderId,
      data: responseData
    };
  } catch (error) {
    const { maskSensitiveData } = require('../utils/maskSensitiveData');
    
    const safeErrorResponse = error.response?.data ? maskSensitiveData(error.response.data) : null;
    const safeErrorHeaders = error.response?.headers ? maskSensitiveData(error.response.headers) : null;
    
    const errorDetails = {
      orderId: order.id || order.orderId,
      orderNumber: order.orderNumber,
      errorMessage: error.message,
      errorResponse: safeErrorResponse ? JSON.stringify(safeErrorResponse, null, 2) : null,
      errorStatus: error.response?.status,
      errorHeaders: safeErrorHeaders,
      apiUrl: `${SHIPDAY_BASE_URL}/orders`
    };
    
    logger.error('Failed to send order to Shipday:', error, errorDetails);
    
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      details: safeErrorResponse || error.message,
      statusCode: error.response?.status
    };
  }
};


const updateShipdayOrderStatus = async (shipdayOrderId, status) => {
  if (!SHIPDAY_API_KEY || !shipdayOrderId) {
    return { success: false, error: 'Missing Shipday API key or order ID' };
  }
  
  if (status === 'cancelled' || status === 'canceled') {
    return await cancelShipdayOrder(shipdayOrderId);
  }
  
  try {
    const response = await retryWithBackoff(async () => {
      const apiResponse = await axios.put(`${SHIPDAY_BASE_URL}/orders/${shipdayOrderId}/status`, { status }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${SHIPDAY_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      return apiResponse;
    });
    
    const responseData = response.data;
    
    logger.info('Shipday order status updated', {
      shipdayOrderId,
      status
    });
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    logger.warn('Shipday status update not supported or failed (this is expected - use Shipday dashboard for status changes):', {
      shipdayOrderId,
      status,
      error: error.message,
      statusCode: error.response?.status
    });
    return {
      success: false,
      error: 'Shipday may not support direct status updates via API. Use Shipday dashboard - changes will sync via webhook.',
      details: error.response?.data || error.message
    };
  }
};


const cancelShipdayOrder = async (shipdayOrderId) => {
  if (!SHIPDAY_API_KEY || !shipdayOrderId) {
    return { success: false, error: 'Missing Shipday API key or order ID' };
  }
  
  try {
    const response = await retryWithBackoff(async () => {
      const apiResponse = await axios.delete(`${SHIPDAY_BASE_URL}/orders/${shipdayOrderId}`, {
        headers: {
          'Authorization': `Basic ${SHIPDAY_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      return apiResponse;
    });
    
    const responseData = response.data || {};
    
    logger.info('Shipday order cancelled', {
      shipdayOrderId
    });
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    logger.error('Failed to cancel Shipday order:', error, {
      shipdayOrderId
    });
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
};


const getShipdayOrder = async (shipdayOrderId) => {
  if (!SHIPDAY_API_KEY || !shipdayOrderId) {
    return { success: false, error: 'Missing Shipday API key or order ID' };
  }
  
  try {
    const response = await retryWithBackoff(async () => {
      const apiResponse = await axios.get(`${SHIPDAY_BASE_URL}/orders/${shipdayOrderId}`, {
        headers: {
          'Authorization': `Basic ${SHIPDAY_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      return apiResponse;
    });
    
    const responseData = response.data;
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    logger.error('Failed to get Shipday order:', error, {
      shipdayOrderId
    });
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
};

const updateShipdayOrder = async (shipdayOrderId, order) => {
  if (!SHIPDAY_API_KEY || !shipdayOrderId) {
    return { success: false, error: 'Missing Shipday API key or order ID' };
  }
  
  if (!order) {
    return { success: false, error: 'Order data is required' };
  }
  
  try {
    const shipdayOrder = mapOrderToShipdayFormat(order);
    
    const response = await retryWithBackoff(async () => {
      const apiResponse = await axios.put(`${SHIPDAY_BASE_URL}/orders/${shipdayOrderId}`, shipdayOrder, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${SHIPDAY_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      return apiResponse;
    });
    
    const responseData = response.data;
    
    logger.info('Shipday order updated successfully', {
      shipdayOrderId,
      orderId: order.id || order.orderId,
      orderNumber: order.orderNumber
    });
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    logger.error('Failed to update Shipday order:', error, {
      shipdayOrderId,
      orderId: order.id || order.orderId,
      orderNumber: order.orderNumber,
      errorMessage: error.message,
      statusCode: error.response?.status,
      responseData: error.response?.data
    });
    
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      details: error.response?.data || error.message,
      statusCode: error.response?.status
    };
  }
};

module.exports = {
  sendOrderToShipday,
  updateShipdayOrderStatus,
  updateShipdayOrder,
  cancelShipdayOrder,
  getShipdayOrder,
  mapOrderToShipdayFormat
};


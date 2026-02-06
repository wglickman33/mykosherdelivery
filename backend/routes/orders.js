const express = require('express');
const { Order, Restaurant, Profile, AdminNotification } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { sendOrderConfirmationEmail } = require('../services/emailService');
const { emitOrderCreated } = require('../utils/events');
const { appEvents } = require('../utils/events');
const logger = require('../utils/logger');

const router = express.Router();

async function createGlobalAdminNotification(payload) {
  try {
    const notif = await AdminNotification.create({
      type: payload.type,
      title: payload.title,
      message: payload.body || payload.message || '',
      readBy: [],
      data: payload.ref || null
    });
    
    try { 
      appEvents.emit('admin.notification.created', { 
        id: notif.id, 
        type: notif.type, 
        title: notif.title, 
        message: notif.message, 
        data: notif.data, 
        createdAt: notif.createdAt 
      }); 
    } catch (err) { 
      logger.warn('Emit admin notification error', err); 
    }
    
    return notif;
  } catch (err) { 
    logger.warn('Create global admin notification error', err); 
    return null;
  }
}

router.post('/guest', [
  body('guestInfo').isObject(),
  body('restaurantGroups').isObject(),
  body('deliveryAddress').isObject(),
  body('deliveryAddress.street').optional().isString().trim().isLength({ max: 200 }),
  body('deliveryAddress.apartment').optional().isString().trim().isLength({ max: 20 }),
  body('deliveryAddress.city').optional().isString().trim().isLength({ max: 100 }),
  body('deliveryAddress.state').optional().isString().trim().isLength({ max: 2 }),
  body('deliveryAddress.zip_code').optional().isString().trim().matches(/^\d{5}$/),
  body('deliveryInstructions').optional().isString().trim().isLength({ max: 500 }),
  body('subtotal').isNumeric(),
  body('deliveryFee').isNumeric().optional(),
  body('tax').isNumeric().optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      guestInfo,
      restaurantGroups,
      deliveryAddress,
      deliveryInstructions,
      deliveryFee = 0,
      tax = 0
    } = req.body;

    // Sanitize address fields to prevent long text in wrong fields
    const sanitizedAddress = {
      ...deliveryAddress,
      apartment: deliveryAddress.apartment ? String(deliveryAddress.apartment).trim().substring(0, 20) : undefined,
      street: deliveryAddress.street ? String(deliveryAddress.street).trim().substring(0, 200) : undefined,
      city: deliveryAddress.city ? String(deliveryAddress.city).trim().substring(0, 100) : undefined,
      state: deliveryAddress.state ? String(deliveryAddress.state).trim().substring(0, 2) : undefined,
      zip_code: deliveryAddress.zip_code ? String(deliveryAddress.zip_code).trim().substring(0, 5) : undefined
    };

    const sanitizedInstructions = deliveryInstructions ? String(deliveryInstructions).trim().substring(0, 500) : null;

    const { validateDeliveryAddress } = require('../services/deliveryZoneService');
    const addressValidation = await validateDeliveryAddress(sanitizedAddress);
    
    if (!addressValidation.isValid) {
      logger.warn('Guest order rejected due to invalid delivery address', {
        zipCode: deliveryAddress.zip_code || deliveryAddress.zipCode || deliveryAddress.postal_code,
        error: addressValidation.error
      });
      return res.status(400).json({
        error: 'Invalid delivery address',
        message: addressValidation.error || 'We don\'t deliver to this address'
      });
    }

    const orders = [];

    for (const [restaurantId, group] of Object.entries(restaurantGroups)) {
      const orderNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      
      const order = await Order.create({
        userId: null,
        restaurantId: restaurantId,
        orderNumber: orderNumber,
        status: 'pending',
        items: group.items,
        subtotal: group.total,
        deliveryFee: deliveryFee / Object.keys(restaurantGroups).length,
        tax: (tax * group.total) / Object.values(restaurantGroups).reduce((sum, g) => sum + g.total, 0),
        total: group.total + (deliveryFee / Object.keys(restaurantGroups).length) + ((tax * group.total) / Object.values(restaurantGroups).reduce((sum, g) => sum + g.total, 0)),
        deliveryAddress: sanitizedAddress,
        deliveryInstructions: sanitizedInstructions,
        guestInfo: guestInfo
      });

      orders.push(order);
    }

    res.status(201).json({
      success: true,
      data: orders,
      message: 'Guest orders created successfully'
    });

  } catch (error) {
    console.error('Error creating guest order:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create guest order'
    });
  }
});

router.post('/', authenticateToken, [
  body('restaurantGroups').isObject(),
  body('deliveryAddress').isObject(),
  body('deliveryAddress.street').optional().isString().trim().isLength({ max: 200 }),
  body('deliveryAddress.apartment').optional().isString().trim().isLength({ max: 20 }),
  body('deliveryAddress.city').optional().isString().trim().isLength({ max: 100 }),
  body('deliveryAddress.state').optional().isString().trim().isLength({ max: 2 }),
  body('deliveryAddress.zip_code').optional().isString().trim().matches(/^\d{5}$/),
  body('deliveryInstructions').optional().isString().trim().isLength({ max: 500 }),
  body('subtotal').isNumeric(),
  body('deliveryFee').isNumeric().optional(),
  body('tax').isNumeric().optional(),
  body('total').isNumeric(),
  body('tip').isNumeric().optional(),
  body('discountAmount').isNumeric().optional(),
  body('appliedPromo').optional().custom(value => {
    return value === null || typeof value === 'object';
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const { maskSensitiveData } = require('../utils/maskSensitiveData');
      logger.warn('Order validation failed:', {
        errors: errors.array(),
        body: maskSensitiveData(req.body)
      });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      restaurantGroups,
      deliveryAddress,
      deliveryInstructions,
      deliveryFee = 0,
      tip = 0,
      tax = 0,
      subtotal = 0,
      total = 0,
      discountAmount = 0,
      appliedPromo = null
    } = req.body;

    // Sanitize address fields to prevent long text in wrong fields
    const sanitizedAddress = {
      ...deliveryAddress,
      apartment: deliveryAddress.apartment ? String(deliveryAddress.apartment).trim().substring(0, 20) : undefined,
      street: deliveryAddress.street ? String(deliveryAddress.street).trim().substring(0, 200) : undefined,
      city: deliveryAddress.city ? String(deliveryAddress.city).trim().substring(0, 100) : undefined,
      state: deliveryAddress.state ? String(deliveryAddress.state).trim().substring(0, 2) : undefined,
      zip_code: deliveryAddress.zip_code ? String(deliveryAddress.zip_code).trim().substring(0, 5) : undefined
    };

    const sanitizedInstructions = deliveryInstructions ? String(deliveryInstructions).trim().substring(0, 500) : null;

    const { validateDeliveryAddress } = require('../services/deliveryZoneService');
    const addressValidation = await validateDeliveryAddress(sanitizedAddress);
    
    if (!addressValidation.isValid) {
      logger.warn('Order rejected due to invalid delivery address', {
        userId: req.userId,
        zipCode: deliveryAddress.zip_code || deliveryAddress.zipCode || deliveryAddress.postal_code,
        error: addressValidation.error
      });
      return res.status(400).json({
        error: 'Invalid delivery address',
        message: addressValidation.error || 'We don\'t deliver to this address'
      });
    }

    const orderNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    const allItems = [];
    Object.entries(restaurantGroups).forEach(([restaurantId, group]) => {
      const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items);
      groupItems.forEach(item => {
        allItems.push({
          ...item,
          restaurantId: restaurantId
        });
      });
    });

    const order = await Order.create({
      userId: req.userId,
      restaurantId: null,
      restaurantGroups: restaurantGroups,
      orderNumber: orderNumber,
      status: 'pending',
      items: allItems,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      tip: tip,
      tax: tax,
      total: total,
      discountAmount: discountAmount,
      appliedPromo: appliedPromo,
      deliveryAddress: sanitizedAddress,
      deliveryInstructions: sanitizedInstructions
    });

    const fullOrderData = await Order.findByPk(order.id, {
      include: [
        {
          model: Profile,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'address', 'phone']
        }
      ]
    });

    const orderData = fullOrderData.toJSON();
    if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
      const restaurantIds = Object.keys(orderData.restaurantGroups);
      const restaurants = await Restaurant.findAll({
        where: { id: restaurantIds },
        attributes: ['id', 'name', 'address', 'phone']
      });
      orderData.restaurants = restaurants;
      orderData.isMultiRestaurant = restaurants.length > 1;
    } else if (orderData.restaurant) {
      orderData.restaurants = [orderData.restaurant];
      orderData.isMultiRestaurant = false;
    }

    emitOrderCreated(orderData);

    try {
      await createGlobalAdminNotification({
        type: 'order.created',
        title: `Order ${orderNumber} created`,
        body: `${orderData.user?.firstName || 'User'} ${orderData.user?.lastName || ''}`.trim(),
        ref: { kind: 'order', id: order.id }
      });
    } catch (err) { logger.warn('order.created notification failed', err); }

    res.status(201).json({
      success: true,
      data: {
        orders: [order]
      },
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create order'
    });
  }
});

router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.role !== 'admin' && req.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own orders'
      });
    }

    const { status, limit = 50, offset = 0 } = req.query;
    
    const whereClause = { userId };
    if (status) {
      whereClause.status = status;
    }

    const orders = await Order.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
        }
      ]
    });

    const enhancedOrders = await Promise.all(orders.map(async (order) => {
      const orderData = order.toJSON();
      
      if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 1) {
        const restaurantIds = Object.keys(orderData.restaurantGroups);
        const restaurants = await Restaurant.findAll({
          where: { id: restaurantIds },
          attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
        });
        
        orderData.restaurants = restaurants;
        orderData.isMultiRestaurant = true;
      } else if (orderData.restaurant) {
        orderData.restaurants = [orderData.restaurant];
        orderData.isMultiRestaurant = false;
      }
      
      return orderData;
    }));

    res.json(enhancedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch orders'
    });
  }
});

router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
        },
        {
          model: Profile,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    if (req.user.role !== 'admin' && order.userId !== req.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own orders'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order'
    });
  }
});

router.patch('/:orderId/status', authenticateToken, [
  body('status').isIn(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'])
], async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'restaurant_owner') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admins and restaurant owners can update order status'
      });
    }

    await order.update({ status });

    try {
      await createGlobalAdminNotification({
        type: 'order.status_changed',
        title: `Order ${order.orderNumber || order.id} ${status.replace('_',' ')}`,
        ref: { kind: 'order', id: order.id }
      });
    } catch (err) { logger.warn('order.status_changed notification failed', err); }

    res.json({
      success: true,
      data: order,
      message: `Order status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update order status'
    });
  }
});

router.patch('/:orderId/cancel', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    if (req.user.role !== 'admin' && order.userId !== req.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only cancel your own orders'
      });
    }

    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        error: 'Cannot cancel order',
        message: `Order is already ${order.status}`
      });
    }

    await order.update({ status: 'cancelled' });

    res.json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cancel order'
    });
  }
});

router.post('/:orderId/reorder', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const originalOrder = await Order.findByPk(orderId, {
      include: [
        {
          model: Restaurant,
          as: 'restaurant'
        }
      ]
    });

    if (!originalOrder) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Original order does not exist'
      });
    }

    if (req.user.role !== 'admin' && originalOrder.userId !== req.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only reorder your own orders'
      });
    }

    const itemsToReorder = Array.isArray(originalOrder.items) ? 
      originalOrder.items : 
      Object.values(originalOrder.items);

    if (originalOrder.restaurantGroups) {
      const restaurantIds = Object.keys(originalOrder.restaurantGroups);
      const restaurants = await Restaurant.findAll({
        where: { id: restaurantIds },
        attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
      });

      res.status(200).json({
        success: true,
        data: {
          items: itemsToReorder,
          restaurantGroups: originalOrder.restaurantGroups,
          restaurants: restaurants,
          isMultiRestaurant: true
        },
        message: 'Items ready for reorder'
      });
    } else {
      res.status(200).json({
        success: true,
        data: {
          items: itemsToReorder,
          restaurant: {
            id: originalOrder.restaurantId,
            name: originalOrder.restaurant?.name || 'Restaurant'
          },
          isMultiRestaurant: false
        },
        message: 'Items ready for reorder'
      });
    }

  } catch (error) {
    console.error('Error reordering:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reorder'
    });
  }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, restaurantId, limit = 100, offset = 0 } = req.query;
    
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (restaurantId) {
      whereClause.restaurantId = restaurantId;
    }

    const orders = await Order.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'address', 'phone']
        },
        {
          model: Profile,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch orders'
    });
  }
});

router.post('/send-confirmation', authenticateToken, [
  body('orderIds').exists(),
  body('customerInfo').exists(),
  body('total').exists()
], async (req, res) => {
  try {

    
    const errors = validationResult(req);
          if (!errors.isEmpty()) {
        return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    let { orderIds, customerInfo, total } = req.body;
    
    if (!Array.isArray(orderIds)) {
      if (typeof orderIds === 'string') {
        orderIds = [orderIds];
      } else if (typeof orderIds === 'object' && orderIds !== null) {
        orderIds = Object.values(orderIds);
      } else {
        return res.status(400).json({
          error: 'Invalid orderIds format',
          message: 'orderIds must be an array'
        });
      }
    }
    
    if (typeof total === 'string') {
      total = parseFloat(total);
    }
    if (isNaN(total)) {
      return res.status(400).json({
        error: 'Invalid total format',
        message: 'total must be a number'
      });
    }
    const userId = req.userId;

    const orders = await Order.findAll({
      where: {
        id: orderIds,
        userId: userId
      },
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['name']
        }
      ]
    });

    if (orders.length !== orderIds.length) {
      return res.status(400).json({
        error: 'Invalid orders',
        message: 'Some orders are invalid or do not belong to user'
      });
    }

    const emailResult = await sendOrderConfirmationEmail({
      orderIds: orderIds,
      customerInfo: customerInfo,
      total: total,
      orders: orders
    });

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Order confirmation email sent successfully',
        emailId: emailResult.emailId
      });
    } else {
      res.status(500).json({
        error: 'Email sending failed',
        message: 'Order created but confirmation email failed to send'
      });
    }

  } catch (error) {
    console.error('Error sending confirmation email:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send confirmation email'
    });
  }
});

router.post('/webhooks/shipday', async (req, res) => {
  try {
    const { maskSensitiveData } = require('../utils/maskSensitiveData');
    logger.info('🔔 Shipday webhook endpoint hit', {
      method: req.method,
      path: req.path,
      headers: maskSensitiveData(req.headers),
      body: maskSensitiveData(req.body),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    const webhookSecret = process.env.SHIPDAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = req.headers['authorization'];
      const tokenHeader = req.headers['x-shipday-token'] || req.headers['x-webhook-token'] || req.headers['token'];
      const providedToken = authHeader?.replace('Bearer ', '') || tokenHeader;
      
      logger.info('Shipday webhook headers received:', {
        hasAuthorization: !!req.headers['authorization'],
        hasXShipdayToken: !!req.headers['x-shipday-token'],
        hasXWebhookToken: !!req.headers['x-webhook-token'],
        hasToken: !!req.headers['token'],
        allHeaderNames: Object.keys(req.headers)
      });
      
      if (!providedToken || providedToken !== webhookSecret) {
        logger.warn('Shipday webhook authentication failed', {
          hasToken: !!providedToken,
          expectedToken: webhookSecret,
          providedToken: providedToken,
          ip: req.ip
        });
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid webhook token' 
        });
      }
    }

    const webhookData = req.body;
    
    logger.info('✅ Shipday webhook authenticated, processing:', {
      event: webhookData.event,
      orderStatus: webhookData.order_status,
      shipdayOrderId: webhookData.order?.id,
      orderNumber: webhookData.order?.order_number
    });

    const shipdayOrderId = (webhookData.order?.id || webhookData.orderId || webhookData.id)?.toString();
    const shipdayStatus = webhookData.order_status || webhookData.status;
    const referenceNumber = (webhookData.order?.order_number || webhookData.referenceNumber)?.toString();

    if (!shipdayOrderId && !referenceNumber) {
      logger.warn('Shipday webhook missing order identifier:', webhookData);
      return res.status(400).json({
        error: 'Missing order identifier',
        message: 'Webhook must include orderId or referenceNumber'
      });
    }

    if (!shipdayStatus) {
      logger.warn('Shipday webhook missing status:', webhookData);
      return res.status(400).json({
        error: 'Missing status',
        message: 'Webhook must include status'
      });
    }

    let order;
    if (shipdayOrderId) {
      order = await Order.findOne({
        where: { shipdayOrderId: shipdayOrderId }
      });
    }
    
    if (!order && referenceNumber) {
      order = await Order.findOne({
        where: { orderNumber: referenceNumber }
      });
    }

    if (!order) {
      logger.warn('Order not found for Shipday webhook:', {
        shipdayOrderId,
        referenceNumber
      });
      return res.status(404).json({
        error: 'Order not found',
        message: `No order found with shipdayOrderId: ${shipdayOrderId} or orderNumber: ${referenceNumber}`
      });
    }

    const STATUS_MAP = {
      'not_assigned': 'pending',
      'started': 'confirmed',
      'picked_up': 'preparing',
      'ready_to_deliver': 'out_for_delivery',
      'on_the_way': 'out_for_delivery',
      'already_delivered': 'delivered',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'canceled': 'cancelled',
      'pending': 'pending',
      'assigned': 'confirmed',
      'accepted': 'confirmed',
      'confirmed': 'confirmed',
      'pickedup': 'preparing',
      'pickup': 'preparing',
      'on_the_way_to_customer': 'out_for_delivery',
      'in_transit': 'out_for_delivery',
      'out_for_delivery': 'out_for_delivery',
      'completed': 'delivered'
    };

    const mappedStatus = STATUS_MAP[shipdayStatus.toLowerCase()] || shipdayStatus.toLowerCase();
    
    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(mappedStatus)) {
      logger.warn('Invalid status from Shipday webhook:', {
        shipdayStatus,
        mappedStatus,
        orderId: order.id
      });
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status '${shipdayStatus}' cannot be mapped to a valid order status`
      });
    }

    const previousStatus = order.status;
    if (previousStatus !== mappedStatus) {
      await order.update({ status: mappedStatus });

      if (mappedStatus === 'delivered' && !order.actualDeliveryTime) {
        await order.update({ actualDeliveryTime: new Date() });
      }

      logger.info('Order status updated from Shipday webhook', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        shipdayOrderId: shipdayOrderId,
        previousStatus,
        newStatus: mappedStatus,
        shipdayStatus
      });

      try {
        await createGlobalAdminNotification({
          type: 'order.status_changed',
          title: `Order ${order.orderNumber || order.id} ${previousStatus} → ${mappedStatus}`,
          message: `Status updated via Shipday webhook`,
          ref: { kind: 'order', id: order.id }
        });
      } catch (notifError) {
        logger.warn('Failed to create admin notification for Shipday status update:', notifError);
      }

      try {
        appEvents.emit('order.updated', {
          id: order.id,
          orderNumber: order.orderNumber,
          status: mappedStatus,
          shipdayOrderId: shipdayOrderId,
          previousStatus,
          source: 'shipday'
        });
      } catch (eventError) {
        logger.warn('Failed to emit order status change event:', eventError);
      }
    } else {
      logger.debug('Order status unchanged from Shipday webhook', {
        orderId: order.id,
        status: mappedStatus
      });
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: mappedStatus
    });

  } catch (error) {
    logger.error('Error processing Shipday webhook:', error, {
      webhookData: req.body
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

module.exports = router; 
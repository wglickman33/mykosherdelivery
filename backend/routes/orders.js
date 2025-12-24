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
      readBy: [], // Empty array means no admin has read it yet
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

// Create guest order
router.post('/guest', [
  body('guestInfo').isObject(),
  body('restaurantGroups').isObject(),
  body('deliveryAddress').isObject(),
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

    const orders = [];

    // Create separate orders for each restaurant
    for (const [restaurantId, group] of Object.entries(restaurantGroups)) {
      // Generate random 10-digit order number
      const orderNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      
      const order = await Order.create({
        userId: null, // Guest order
        restaurantId: restaurantId,
        orderNumber: orderNumber,
        status: 'pending',
        items: group.items,
        subtotal: group.total,
        deliveryFee: deliveryFee / Object.keys(restaurantGroups).length,
        tax: (tax * group.total) / Object.values(restaurantGroups).reduce((sum, g) => sum + g.total, 0),
        total: group.total + (deliveryFee / Object.keys(restaurantGroups).length) + ((tax * group.total) / Object.values(restaurantGroups).reduce((sum, g) => sum + g.total, 0)),
        deliveryAddress: deliveryAddress,
        deliveryInstructions: deliveryInstructions || null,
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

// Create new order
router.post('/', authenticateToken, [
  body('restaurantGroups').isObject(),
  body('deliveryAddress').isObject(),
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
      console.error('Order validation failed:', errors.array());
      console.error('Request body:', JSON.stringify(req.body, null, 2));
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

    // Create ONE unified order with multiple restaurants
    // Generate random 10-digit order number
    const orderNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    // Flatten all items from all restaurants into one array
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
      restaurantId: null, // null for multi-restaurant orders
      restaurantGroups: restaurantGroups, // Store the restaurant grouping data
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
      deliveryAddress: deliveryAddress,
      deliveryInstructions: deliveryInstructions || null
    });

    // Broadcast creation event with full order data including associations
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

    // Enhance with restaurant information for multi-restaurant orders
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

    // Notify all admins
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
        orders: [order] // Return array for consistency, but only one order
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

// Get user's orders
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only access their own orders (except admins)
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

    // Enhance orders with restaurant information for multi-restaurant orders
    const enhancedOrders = await Promise.all(orders.map(async (order) => {
      const orderData = order.toJSON();
      
      if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 1) {
        // Multi-restaurant order - fetch all restaurant details
        const restaurantIds = Object.keys(orderData.restaurantGroups);
        const restaurants = await Restaurant.findAll({
          where: { id: restaurantIds },
          attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
        });
        
        orderData.restaurants = restaurants;
        orderData.isMultiRestaurant = true;
      } else if (orderData.restaurant) {
        // Single restaurant order - use existing association
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

// Get single order by ID
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

    // Users can only access their own orders (except admins)
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

// Update order status (admin/restaurant owner only)
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

    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'restaurant_owner') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admins and restaurant owners can update order status'
      });
    }

    // Update status
    await order.update({ status });

    // Notify all admins
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

// Cancel order (user or admin)
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

    // Users can only cancel their own orders (except admins)
    if (req.user.role !== 'admin' && order.userId !== req.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only cancel your own orders'
      });
    }

    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        error: 'Cannot cancel order',
        message: `Order is already ${order.status}`
      });
    }

    // Update status to cancelled
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

// Reorder functionality
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

    // Users can only reorder their own orders (except admins)
    if (req.user.role !== 'admin' && originalOrder.userId !== req.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only reorder your own orders'
      });
    }

    // Return order items and restaurant info for adding to cart (don't create new order)
    const itemsToReorder = Array.isArray(originalOrder.items) ? 
      originalOrder.items : 
      Object.values(originalOrder.items);

    // Handle both single and multi-restaurant orders
    if (originalOrder.restaurantGroups) {
      // Multi-restaurant order - return grouped data
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
      // Single restaurant order - legacy format
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

// Get all orders (admin only)
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

// Send order confirmation email
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
    
    // Ensure orderIds is an array
    if (!Array.isArray(orderIds)) {
      if (typeof orderIds === 'string') {
        orderIds = [orderIds];
      } else if (typeof orderIds === 'object' && orderIds !== null) {
        // Convert object to array (handle case where it's sent as {0: 'id1', 1: 'id2'})
        orderIds = Object.values(orderIds);
      } else {
        return res.status(400).json({
          error: 'Invalid orderIds format',
          message: 'orderIds must be an array'
        });
      }
    }
    
    // Ensure total is a number
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

    // Verify orders belong to user
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

    // Send confirmation email
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

// Shipday webhook endpoint for order status updates
router.post('/webhooks/shipday', async (req, res) => {
  try {
    // Log ALL incoming webhook requests for debugging
    logger.info('🔔 Shipday webhook endpoint hit', {
      method: req.method,
      path: req.path,
      headers: JSON.stringify(req.headers, null, 2),
      body: JSON.stringify(req.body, null, 2),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // Verify webhook token/secret if configured
    const webhookSecret = process.env.SHIPDAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      // Check for token in Authorization header or custom header
      const authHeader = req.headers['authorization'];
      const tokenHeader = req.headers['x-shipday-token'] || req.headers['x-webhook-token'] || req.headers['token'];
      const providedToken = authHeader?.replace('Bearer ', '') || tokenHeader;
      
      // Log header presence (not values) for debugging
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
    
    logger.info('✅ Shipday webhook authenticated, processing:');
    console.log('🔍 DEBUG: Webhook payload keys:', Object.keys(webhookData));
    console.log('🔍 DEBUG: Webhook full body:', JSON.stringify(webhookData, null, 2));

    // Extract Shipday order ID and status from webhook payload
    // The exact structure may vary - adjust based on Shipday's webhook format
    const shipdayOrderId = webhookData.orderId || webhookData.id || webhookData.data?.id;
    const shipdayStatus = webhookData.status || webhookData.data?.status;
    const referenceNumber = webhookData.referenceNumber || webhookData.data?.referenceNumber;

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

    // Find order by shipdayOrderId or referenceNumber (our orderNumber)
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
      'pending': 'pending',
      'assigned': 'confirmed',
      'accepted': 'confirmed',
      'confirmed': 'confirmed',
      'picked_up': 'preparing',
      'pickedup': 'preparing',
      'pickup': 'preparing',
      'on_the_way': 'out_for_delivery',
      'on_the_way_to_customer': 'out_for_delivery',
      'in_transit': 'out_for_delivery',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'completed': 'delivered',
      'cancelled': 'cancelled',
      'canceled': 'cancelled'
    };

    const mappedStatus = STATUS_MAP[shipdayStatus.toLowerCase()] || shipdayStatus.toLowerCase();
    
    // Validate mapped status
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

    // Update order status if it has changed
    const previousStatus = order.status;
    if (previousStatus !== mappedStatus) {
      await order.update({ status: mappedStatus });

      // Update delivery time if delivered
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

      // Create admin notification for status change
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

      // Emit event for real-time UI updates via SSE
      try {
        // Emit order.updated for SSE stream (AdminOrders listens to this)
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

    // Return success response to Shipday
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
    
    // Return 500 to Shipday so they can retry
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

module.exports = router; 
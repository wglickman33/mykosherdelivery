const express = require('express');
const rateLimit = require('express-rate-limit');
const { 
  NursingHomeOrder, 
  NursingHomeResidentOrder, 
  NursingHomeResident, 
  NursingHomeFacility, 
  NursingHomeMenuItem,
  Profile 
} = require('../models');
const { requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const XLSX = require('xlsx');
const crypto = require('crypto');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY not configured');
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// ============================================================================
// RATE LIMITING & VALIDATION MIDDLEWARE
// ============================================================================

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many payment attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const validateQueryParams = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('residentId').optional().isUUID(),
  query('status').optional().isIn(['draft', 'submitted', 'paid', 'in_progress', 'completed', 'cancelled']),
  query('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
  query('weekStartDate').optional().isISO8601().toDate()
];

const validateResidentOrder = [
  body('residentId').isUUID(),
  body('weekStartDate').isISO8601().toDate(),
  body('weekEndDate').isISO8601().toDate(),
  body('meals').isArray({ min: 1, max: 21 }),
  body('meals.*.day').isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  body('meals.*.mealType').isIn(['breakfast', 'lunch', 'dinner']),
  body('meals.*.items').isArray({ min: 1, max: 10 }),
  body('meals.*.items.*.id').isUUID(),
  body('deliveryAddress').isObject(),
  body('deliveryAddress.street').isString().trim().isLength({ min: 1, max: 200 }),
  body('deliveryAddress.city').isString().trim().isLength({ min: 1, max: 100 }),
  body('deliveryAddress.state').isString().trim().isLength({ min: 2, max: 2 }),
  body('deliveryAddress.zip_code').isString().trim().matches(/^\d{5}$/),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim().isLength({ min: 1, max: 200 })
];

const validateOrderUpdate = [
  body('meals').optional().isArray({ min: 1, max: 21 }),
  body('meals.*.day').optional().isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  body('meals.*.mealType').optional().isIn(['breakfast', 'lunch', 'dinner']),
  body('meals.*.items').optional().isArray({ min: 1, max: 10 }),
  body('meals.*.items.*.id').optional().isUUID(),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 })
];

const validateBulkOrder = [
  body('facilityId').isUUID(),
  body('weekStartDate').isDate(),
  body('weekEndDate').isDate(),
  body('residentMeals').isArray(),
  body('deliveryAddress').isObject()
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateDeadline(weekStartDate) {
  const startDate = new Date(weekStartDate);
  const sunday = new Date(startDate);
  sunday.setDate(startDate.getDate() - 1);
  sunday.setHours(12, 0, 0, 0);
  return sunday;
}

function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `NH-RES-${timestamp}-${random}`;
}

function generateBulkOrderNumber() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `NH-${timestamp}-${random}`.toUpperCase();
}

async function calculateOrderTotalsFromDB(meals) {
  let totalMeals = 0;
  let subtotal = 0;

  for (const meal of meals) {
    if (!meal.items || !Array.isArray(meal.items)) {
      throw new Error('Invalid meal structure');
    }

    totalMeals++;
    
    for (const item of meal.items) {
      const menuItem = await NursingHomeMenuItem.findByPk(item.id);
      
      if (!menuItem) {
        throw new Error(`Menu item not found: ${item.id}`);
      }
      
      if (!menuItem.isActive) {
        throw new Error(`Menu item is not available: ${menuItem.name}`);
      }
      
      subtotal += parseFloat(menuItem.price);
    }
  }

  const tax = subtotal * 0.08875;
  const total = subtotal + tax;

  return {
    totalMeals,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

function calculateBulkOrderTotals(residentMeals) {
  let totalMeals = 0;
  let subtotal = 0;

  const mealPrices = {
    breakfast: 15.00,
    lunch: 21.00,
    dinner: 23.00
  };

  residentMeals.forEach(resident => {
    resident.meals.forEach(meal => {
      totalMeals++;
      subtotal += mealPrices[meal.mealType] || 0;
    });
  });

  const tax = subtotal * 0.08875;
  const total = subtotal + tax;

  return {
    totalMeals,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

// ============================================================================
// PER-RESIDENT ORDERS (Current System)
// ============================================================================

// GET /api/nursing-homes/resident-orders - List resident orders
router.get('/resident-orders', requireNursingHomeUser, validateQueryParams, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const { residentId, status, paymentStatus, weekStartDate } = req.query;

    const where = {};

    if (residentId) {
      where.residentId = residentId;
      
      if (req.user.role === 'nursing_home_user') {
        const resident = await NursingHomeResident.findByPk(residentId);
        if (!resident || resident.assignedUserId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      }
    } else if (req.user.role === 'nursing_home_user') {
      const residents = await NursingHomeResident.findAll({
        where: { assignedUserId: req.user.id },
        attributes: ['id']
      });
      where.residentId = residents.map(r => r.id);
    }

    if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    }

    if (status) {
      where.status = status;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (weekStartDate) {
      where.weekStartDate = weekStartDate;
    }

    const { count, rows: orders } = await NursingHomeResidentOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: NursingHomeResident,
          as: 'resident',
          attributes: ['id', 'name', 'roomNumber']
        },
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name']
        },
        {
          model: Profile,
          as: 'createdBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching resident orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

// POST /api/nursing-homes/resident-orders - Create draft resident order
router.post('/resident-orders', requireNursingHomeUser, validateResidentOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { residentId, weekStartDate, weekEndDate, meals, deliveryAddress, billingEmail, billingName } = req.body;

    const resident = await NursingHomeResident.findByPk(residentId, {
      include: [{
        model: NursingHomeFacility,
        as: 'facility'
      }]
    });

    if (!resident) {
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (resident.assignedUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (resident.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const deadline = calculateDeadline(weekStartDate);
    const totals = await calculateOrderTotalsFromDB(meals);
    const orderNumber = generateOrderNumber();

    const order = await NursingHomeResidentOrder.create({
      residentId,
      facilityId: resident.facilityId,
      createdByUserId: req.user.id,
      orderNumber,
      weekStartDate,
      weekEndDate,
      meals,
      status: 'draft',
      totalMeals: totals.totalMeals,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      paymentStatus: 'pending',
      deliveryAddress,
      deadline,
      residentName: resident.name,
      roomNumber: resident.roomNumber,
      billingEmail: billingEmail || resident.billingEmail,
      billingName: billingName || resident.billingName
    });

    logger.info('Resident order created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      residentId,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error creating resident order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

// PUT /api/nursing-homes/resident-orders/:id - Update draft resident order
router.put('/resident-orders/:id', requireNursingHomeUser, validateOrderUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const { meals, billingEmail, billingName, notes } = req.body;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{
        model: NursingHomeResident,
        as: 'resident'
      }]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.resident.assignedUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    if (order.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Can only edit draft orders',
        message: 'Order has already been submitted'
      });
    }

    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    const updateData = {};
    if (meals) {
      updateData.meals = meals;
      const totals = await calculateOrderTotalsFromDB(meals);
      updateData.totalMeals = totals.totalMeals;
      updateData.subtotal = totals.subtotal;
      updateData.tax = totals.tax;
      updateData.total = totals.total;
    }

    if (billingEmail) updateData.billingEmail = billingEmail;
    if (billingName) updateData.billingName = billingName;
    if (notes !== undefined) updateData.notes = notes;

    await order.update(updateData);

    logger.info('Resident order updated', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: order,
      message: 'Order updated successfully'
    });
  } catch (error) {
    logger.error('Error updating resident order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: error.message
    });
  }
});

// POST /api/nursing-homes/resident-orders/:id/submit-and-pay - Submit order and process payment
router.post('/resident-orders/:id/submit-and-pay', paymentLimiter, requireNursingHomeUser, [
  body('paymentMethodId').optional().isString().trim()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethodId } = req.body;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{
        model: NursingHomeResident,
        as: 'resident'
      }]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.resident.assignedUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    if (order.status === 'submitted' || order.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order already submitted'
      });
    }

    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot submit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM. Contact admin for assistance.'
      });
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.total * 100),
        currency: 'usd',
        payment_method: paymentMethodId || order.resident.paymentMethodId,
        confirm: true,
        automatic_payment_methods: paymentMethodId ? undefined : { enabled: true, allow_redirects: 'never' },
        description: `Weekly Meal Order - ${order.residentName} - Week of ${order.weekStartDate}`,
        metadata: {
          orderNumber: order.orderNumber,
          residentName: order.residentName,
          roomNumber: order.roomNumber || '',
          weekStartDate: order.weekStartDate,
          weekEndDate: order.weekEndDate,
          totalMeals: order.totalMeals.toString(),
          billingName: order.billingName || ''
        },
        receipt_email: order.billingEmail,
        statement_descriptor: 'MKD MEALS'
      });

      await order.update({
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'stripe',
        paymentIntentId: paymentIntent.id,
        paidAt: new Date(),
        submittedAt: new Date()
      });

      logger.info('Resident order paid', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentIntentId: paymentIntent.id,
        amount: order.total
      });

      res.json({
        success: true,
        data: order,
        message: 'Order submitted and payment processed successfully'
      });
    } catch (stripeError) {
      logger.error('Stripe payment failed:', stripeError);
      
      await order.update({
        paymentStatus: 'failed'
      });

      return res.status(402).json({
        success: false,
        error: 'Payment failed',
        message: stripeError.message
      });
    }
  } catch (error) {
    logger.error('Error submitting and paying for order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process order',
      message: error.message
    });
  }
});

// GET /api/nursing-homes/resident-orders/:id/export - Export resident order
router.get('/resident-orders/:id/export', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [
        {
          model: NursingHomeResident,
          as: 'resident'
        },
        {
          model: NursingHomeFacility,
          as: 'facility'
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.resident.assignedUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    worksheetData.push(['Weekly Meal Order']);
    worksheetData.push(['Resident:', order.residentName]);
    worksheetData.push(['Room:', order.roomNumber || 'N/A']);
    worksheetData.push(['Order Number:', order.orderNumber]);
    worksheetData.push(['Week:', `${order.weekStartDate} to ${order.weekEndDate}`]);
    worksheetData.push(['Total:', `$${order.total}`]);
    worksheetData.push(['Payment Status:', order.paymentStatus]);
    worksheetData.push([]);
    worksheetData.push(['Day', 'Meal Type', 'Items', 'Bagel Type', 'Price']);

    order.meals.forEach(meal => {
      const itemNames = meal.items.map(i => i.name).join(', ');
      const mealPrice = meal.items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
      
      worksheetData.push([
        meal.day,
        meal.mealType,
        itemNames,
        meal.bagelType || '',
        `$${mealPrice.toFixed(2)}`
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Meal Order');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="meal-order-${order.orderNumber}.xlsx"`);
    res.send(buffer);

    logger.info('Resident order exported', {
      orderId: order.id,
      exportedBy: req.user.id
    });
  } catch (error) {
    logger.error('Error exporting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export order',
      message: error.message
    });
  }
});

// ============================================================================
// BULK FACILITY ORDERS (Legacy System)
// ============================================================================

// GET /api/nursing-homes/orders - List bulk facility orders
router.get('/orders', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, facilityId, weekStartDate } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    if (req.user.role === 'nursing_home_user' || req.user.role === 'nursing_home_admin') {
      if (req.user.role !== 'admin') {
        where.facilityId = req.user.nursingHomeFacilityId;
      } else if (facilityId) {
        where.facilityId = facilityId;
      }
    } else if (facilityId) {
      where.facilityId = facilityId;
    }

    if (req.user.role === 'nursing_home_user') {
      where.createdByUserId = req.user.id;
    }

    if (status) {
      where.status = status;
    }
    if (weekStartDate) {
      where.weekStartDate = weekStartDate;
    }

    const { count, rows: orders } = await NursingHomeOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address']
        },
        {
          model: Profile,
          as: 'createdBy',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching nursing home orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

// GET /api/nursing-homes/orders/:id - Get bulk order details
router.get('/orders/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeOrder.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address', 'contactEmail', 'contactPhone']
        },
        {
          model: Profile,
          as: 'createdBy',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
      message: error.message
    });
  }
});

// POST /api/nursing-homes/orders - Create/draft bulk order
router.post('/orders', requireNursingHomeUser, validateBulkOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { facilityId, weekStartDate, weekEndDate, residentMeals, deliveryAddress } = req.body;

    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    const deadline = calculateDeadline(weekStartDate);
    const totals = calculateBulkOrderTotals(residentMeals);
    const orderNumber = generateBulkOrderNumber();

    const order = await NursingHomeOrder.create({
      facilityId,
      createdByUserId: req.user.id,
      orderNumber,
      weekStartDate,
      weekEndDate,
      residentMeals,
      status: 'draft',
      totalMeals: totals.totalMeals,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      deliveryAddress,
      deadline
    });

    logger.info('Nursing home order created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      facilityId,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

// PUT /api/nursing-homes/orders/:id - Update bulk order (before deadline)
router.put('/orders/:id', requireNursingHomeUser, [
  body('residentMeals').optional().isArray(),
  body('deliveryAddress').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const order = await NursingHomeOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const now = new Date();
    if (now > order.deadline && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    if (order.status === 'submitted' && req.user.role !== 'admin' && req.user.role !== 'nursing_home_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit submitted order'
      });
    }

    if (updateData.residentMeals) {
      const totals = calculateBulkOrderTotals(updateData.residentMeals);
      updateData.totalMeals = totals.totalMeals;
      updateData.subtotal = totals.subtotal;
      updateData.tax = totals.tax;
      updateData.total = totals.total;
    }

    await order.update(updateData);

    logger.info('Nursing home order updated', {
      orderId: order.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: error.message
    });
  }
});

// POST /api/nursing-homes/orders/:id/submit - Submit bulk order (locks it)
router.post('/orders/:id/submit', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    if (order.status === 'submitted') {
      return res.status(400).json({
        success: false,
        error: 'Order already submitted'
      });
    }

    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot submit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    await order.update({
      status: 'submitted',
      submittedAt: new Date()
    });

    logger.info('Nursing home order submitted', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      submittedBy: req.user.id
    });

    res.json({
      success: true,
      data: order,
      message: 'Order submitted successfully'
    });
  } catch (error) {
    logger.error('Error submitting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit order',
      message: error.message
    });
  }
});

// DELETE /api/nursing-homes/orders/:id - Cancel bulk order
router.delete('/orders/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role !== 'admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await order.update({ status: 'cancelled' });

    logger.info('Nursing home order cancelled', {
      orderId: order.id,
      cancelledBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
      message: error.message
    });
  }
});

// GET /api/nursing-homes/orders/:id/export - Export bulk order for resident
router.get('/orders/:id/export', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { residentId } = req.query;

    const order = await NursingHomeOrder.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    let mealsToExport = order.residentMeals;
    if (residentId) {
      mealsToExport = order.residentMeals.filter(rm => rm.residentId === residentId);
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    worksheetData.push(['Nursing Home Meal Order']);
    worksheetData.push(['Facility:', order.facility.name]);
    worksheetData.push(['Order Number:', order.orderNumber]);
    worksheetData.push(['Week:', `${order.weekStartDate} to ${order.weekEndDate}`]);
    worksheetData.push([]);
    worksheetData.push(['Resident', 'Room', 'Day', 'Meal Type', 'Main/Entree', 'Side/Soup', 'Dessert', 'Bagel Type', 'Special Notes']);

    mealsToExport.forEach(resident => {
      resident.meals.forEach(meal => {
        const mainItem = meal.items.find(i => ['main', 'entree'].includes(i.category));
        const sideItems = meal.items.filter(i => ['side', 'soup'].includes(i.category));
        const dessertItem = meal.items.find(i => i.category === 'dessert');

        worksheetData.push([
          resident.residentName,
          resident.roomNumber || '',
          meal.day,
          meal.mealType,
          mainItem?.name || '',
          sideItems.map(s => s.name).join(', '),
          dessertItem?.name || '',
          meal.bagelType || '',
          ''
        ]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Meal Orders');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="nursing-home-order-${order.orderNumber}.xlsx"`);
    res.send(buffer);

    logger.info('Nursing home order exported', {
      orderId: order.id,
      exportedBy: req.user.id,
      residentId: residentId || 'all'
    });
  } catch (error) {
    logger.error('Error exporting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export order',
      message: error.message
    });
  }
});

module.exports = router;

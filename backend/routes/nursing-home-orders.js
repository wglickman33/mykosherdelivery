const express = require('express');
const rateLimit = require('express-rate-limit');
const { 
  NursingHomeOrder, 
  NursingHomeResidentOrder, 
  NursingHomeRefund,
  NursingHomeResident, 
  NursingHomeFacility, 
  NursingHomeMenuItem,
  Profile 
} = require('../models');
const { Op } = require('sequelize');
const { requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const { generateOrderNumber: generateBaseOrderNumber } = require('../services/orderService');
const { NH_CONFIG, API_CONFIG, ORDER_CONFIG } = require('../config/constants');
const logger = require('../utils/logger');
const { createAdminNotification } = require('../utils/adminNotifications');
const ExcelJS = require('exceljs');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;
if (!stripe) {
  logger.warn('STRIPE_SECRET_KEY not set; nursing home payment routes will fail');
}

const router = express.Router();

router.get('/residents', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', facilityId, assignedUserId } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (req.user.role === 'admin') {
      if (facilityId) where.facilityId = facilityId;
    } else if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    } else {
      where.facilityId = req.user.nursingHomeFacilityId;
      where.assignedUserId = req.user.id;
    }
    if (assignedUserId && (req.user.role === 'admin' || req.user.role === 'nursing_home_user')) {
      where.assignedUserId = assignedUserId;
    }
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: residents } = await NursingHomeResident.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit, 10) || 50, 100),
      offset,
      order: [['name', 'ASC']],
      include: [
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name'] },
        { model: Profile, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });

    res.json({
      success: true,
      data: residents,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / (parseInt(limit, 10) || 50))
      }
    });
  } catch (error) {
    logger.error('Error fetching residents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch residents',
      message: error.message
    });
  }
});

router.get('/residents/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const resident = await NursingHomeResident.findByPk(req.params.id, {
      include: [
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name', 'address'] },
        { model: Profile, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] }
      ]
    });
    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }
    if (req.user.role === 'nursing_home_user' && resident.assignedUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (req.user.role === 'nursing_home_admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    res.json({ success: true, data: resident });
  } catch (error) {
    logger.error('Error fetching resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resident',
      message: error.message
    });
  }
});

router.get('/menu', requireNursingHomeUser, async (req, res) => {
  try {
    const { mealType, category, isActive = 'true' } = req.query;
    const where = { isActive: isActive === 'true' };
    if (mealType) where.mealType = mealType;
    if (category) where.category = category;

    const menuItems = await NursingHomeMenuItem.findAll({
      where,
      order: [['mealType', 'ASC'], ['category', 'ASC'], ['displayOrder', 'ASC']]
    });

    const groupedMenu = {
      breakfast: { main: [], side: [] },
      lunch: { entree: [], side: [] },
      dinner: { entree: [], side: [], soup: [], dessert: [] }
    };
    menuItems.forEach(item => {
      if (groupedMenu[item.mealType] && groupedMenu[item.mealType][item.category]) {
        groupedMenu[item.mealType][item.category].push(item);
      }
    });

    res.json({
      success: true,
      data: { items: menuItems, grouped: groupedMenu }
    });
  } catch (error) {
    logger.error('Error fetching menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu',
      message: error.message
    });
  }
});

router.get('/menu/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const menuItem = await NursingHomeMenuItem.findByPk(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }
    res.json({ success: true, data: menuItem });
  } catch (error) {
    logger.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item',
      message: error.message
    });
  }
});

const paymentLimiter = rateLimit({
  windowMs: API_CONFIG.RATE_LIMIT.WINDOW_MS,
  max: API_CONFIG.RATE_LIMIT.PAYMENT_MAX_REQUESTS,
  message: 'Too many payment attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const validateQueryParams = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('residentId').optional().isUUID(),
  query('status').optional().isIn(Object.values(NH_CONFIG.STATUSES)),
  query('paymentStatus').optional().isIn(Object.values(NH_CONFIG.PAYMENT_STATUSES)),
  query('weekStartDate').optional().isISO8601().toDate()
];

const validateResidentOrder = [
  body('residentId').isUUID(),
  body('weekStartDate').isISO8601().toDate(),
  body('weekEndDate').isISO8601().toDate(),
  body('meals').isArray({ min: NH_CONFIG.MEALS.MIN_ITEMS_PER_MEAL, max: NH_CONFIG.MEALS.MAX_MEALS_PER_WEEK }),
  body('meals.*.day').isIn(NH_CONFIG.MEALS.DAYS),
  body('meals.*.mealType').isIn(NH_CONFIG.MEALS.TYPES),
  body('meals.*.items').isArray({ min: NH_CONFIG.MEALS.MIN_ITEMS_PER_MEAL, max: NH_CONFIG.MEALS.MAX_ITEMS_PER_MEAL }),
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
  body('meals').optional().isArray({ min: NH_CONFIG.MEALS.MIN_ITEMS_PER_MEAL, max: NH_CONFIG.MEALS.MAX_MEALS_PER_WEEK }),
  body('meals.*.day').optional().isIn(NH_CONFIG.MEALS.DAYS),
  body('meals.*.mealType').optional().isIn(NH_CONFIG.MEALS.TYPES),
  body('meals.*.items').optional().isArray({ min: NH_CONFIG.MEALS.MIN_ITEMS_PER_MEAL, max: NH_CONFIG.MEALS.MAX_ITEMS_PER_MEAL }),
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

function calculateDeadline(weekStartDate) {
  const startDate = new Date(weekStartDate);
  const sunday = new Date(startDate);
  sunday.setDate(startDate.getDate() - 1);
  sunday.setHours(NH_CONFIG.DEADLINE.HOUR, NH_CONFIG.DEADLINE.MINUTE, 0, 0);
  return sunday;
}

function generateOrderNumber() {
  return generateBaseOrderNumber(ORDER_CONFIG.NUMBER_PREFIX.NURSING_HOME_RESIDENT);
}

function generateBulkOrderNumber() {
  return generateBaseOrderNumber(ORDER_CONFIG.NUMBER_PREFIX.NURSING_HOME_BULK);
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
    } else if (req.user.role === 'admin') {
      if (req.query.facilityId) {
        where.facilityId = req.query.facilityId;
      }
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
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
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

router.get('/resident-orders/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [
        { model: NursingHomeResident, as: 'resident', attributes: ['id', 'name', 'roomNumber', 'facilityId'] },
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name', 'address'] }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (req.user.role === 'nursing_home_user') {
      const resident = order.resident || await NursingHomeResident.findByPk(order.residentId);
      if (!resident || resident.assignedUserId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else if (req.user.role === 'nursing_home_admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    } else if (req.user.role !== 'admin' && req.user.role !== 'nursing_home_admin' && req.user.role !== 'nursing_home_user') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Error fetching resident order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order', message: error.message });
  }
});

router.post('/resident-orders/:id/submit-and-pay', paymentLimiter, requireNursingHomeUser, [
  body('paymentMethodId').optional().isString().trim(),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim(),
  body('billingPhone').optional().isString().trim()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethodId, billingEmail, billingName, billingPhone } = req.body;

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

    if (billingEmail || billingName || billingPhone !== undefined) {
      await order.update({
        ...(billingEmail && { billingEmail }),
        ...(billingName && { billingName }),
        ...(billingPhone !== undefined && { billingPhone })
      });
    }

    const receiptEmail = billingEmail || order.billingEmail;
    const billingNameVal = billingName || order.billingName || '';

    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Payment not configured',
        message: 'STRIPE_SECRET_KEY is not set on the server.'
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
          billingName: billingNameVal
        },
        receipt_email: receiptEmail,
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
      await createAdminNotification({
        type: 'nh.order.paid',
        title: 'Nursing home: Order paid',
        message: `Order ${order.orderNumber} (${order.residentName}) paid`,
        ref: { kind: 'nh_resident_order', id: order.id, orderNumber: order.orderNumber, facilityId: order.facilityId }
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Meal Order');

    worksheet.addRow(['Weekly Meal Order']);
    worksheet.addRow(['Resident:', order.residentName]);
    worksheet.addRow(['Room:', order.roomNumber || 'N/A']);
    worksheet.addRow(['Order Number:', order.orderNumber]);
    worksheet.addRow(['Week:', `${order.weekStartDate} to ${order.weekEndDate}`]);
    worksheet.addRow(['Total:', `$${order.total}`]);
    worksheet.addRow(['Payment Status:', order.paymentStatus]);
    worksheet.addRow([]);
    worksheet.addRow(['Day', 'Meal Type', 'Items', 'Bagel Type', 'Price']);

    order.meals.forEach(meal => {
      const itemNames = meal.items.map(i => i.name).join(', ');
      const mealPrice = meal.items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
      worksheet.addRow([
        meal.day,
        meal.mealType,
        itemNames,
        meal.bagelType || '',
        `$${mealPrice.toFixed(2)}`
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="meal-order-${order.orderNumber}.xlsx"`);
    res.send(Buffer.from(buffer));

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

router.get('/resident-orders/:id/refunds', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{ model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name'] }]
    });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (req.user.role === 'nursing_home_admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const refunds = await NursingHomeRefund.findAll({
      where: { residentOrderId: id },
      include: [
        { model: Profile, as: 'processor', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: refunds });
  } catch (error) {
    logger.error('Error fetching resident order refunds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch refunds',
      message: error.message
    });
  }
});

router.post('/resident-orders/:id/refund', requireNursingHomeAdmin, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('reason').notEmpty().trim().withMessage('Refund reason is required'),
  body('refundType').isIn(['full', 'partial']).withMessage('Refund type must be full or partial')
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
    const { amount, reason, refundType } = req.body;
    const adminId = req.user.id;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{ model: NursingHomeResident, as: 'resident' }]
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (req.user.role === 'nursing_home_admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order not paid',
        message: 'Only paid orders can be refunded'
      });
    }

    const orderTotal = parseFloat(order.total || 0);
    const refundAmount = parseFloat(amount);

    const existingRefunds = await NursingHomeRefund.findAll({
      where: { residentOrderId: id, status: 'processed' }
    });
    const totalRefunded = existingRefunds.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const remainingRefundable = orderTotal - totalRefunded;

    if (refundType === 'full') {
      if (Math.abs(refundAmount - remainingRefundable) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'Invalid refund amount',
          message: `Full refund must match remaining refundable amount ($${remainingRefundable.toFixed(2)})`
        });
      }
    }
    if (refundAmount > remainingRefundable) {
      return res.status(400).json({
        success: false,
        error: 'Invalid refund amount',
        message: `Refund cannot exceed remaining refundable amount ($${remainingRefundable.toFixed(2)})`
      });
    }

    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId || !stripe) {
      return res.status(400).json({
        success: false,
        error: 'Cannot refund',
        message: paymentIntentId ? 'Stripe is not configured' : 'No Stripe payment found for this order'
      });
    }

    const refundRecord = await NursingHomeRefund.create({
      residentOrderId: id,
      amount: refundAmount,
      reason: reason.trim(),
      processedBy: adminId,
      status: 'pending'
    });

    try {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: {
          residentOrderId: id,
          orderNumber: order.orderNumber,
          refundId: refundRecord.id
        }
      });

      await refundRecord.update({
        stripeRefundId: stripeRefund.id,
        status: 'processed'
      });

      const isFullRefund = refundType === 'full' || Math.abs(refundAmount - remainingRefundable) < 0.01;
      if (isFullRefund) {
        await order.update({ paymentStatus: 'refunded' });
      }

      await createAdminNotification({
        type: 'nh.order.refunded',
        title: 'Nursing home: Order refunded',
        message: `Order ${order.orderNumber} refunded $${refundAmount.toFixed(2)} (${refundType})`,
        ref: { kind: 'nh_resident_order', id: order.id, orderNumber: order.orderNumber, refundId: refundRecord.id }
      });
      logger.info('Nursing home resident order refund processed', {
        refundId: refundRecord.id,
        residentOrderId: id,
        orderNumber: order.orderNumber,
        amount: refundAmount,
        adminId
      });

      res.json({
        success: true,
        data: {
          refund: refundRecord.toJSON(),
          stripeRefundId: stripeRefund.id
        },
        message: 'Refund processed successfully'
      });
    } catch (stripeError) {
      await refundRecord.update({ status: 'failed' });
      logger.error('Stripe refund failed for resident order:', stripeError, {
        residentOrderId: id,
        refundId: refundRecord.id
      });
      res.status(500).json({
        success: false,
        error: 'Refund failed',
        message: stripeError.message || 'Failed to process refund through Stripe'
      });
    }
  } catch (error) {
    logger.error('Error processing resident order refund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process refund',
      message: error.message
    });
  }
});

router.get('/orders', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, facilityId, weekStartDate } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    if (req.user.role === 'admin') {
      if (facilityId) {
        where.facilityId = facilityId;
      }
    } else if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    } else if (req.user.role === 'nursing_home_user') {
      where.facilityId = req.user.nursingHomeFacilityId;
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
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
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
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
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
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
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
    await createAdminNotification({
      type: 'nh.order.submitted',
      title: 'Nursing home: Weekly order submitted',
      message: `Order ${order.orderNumber} submitted for facility`,
      ref: { kind: 'nh_order', id: order.id, orderNumber: order.orderNumber, facilityId: order.facilityId }
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
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    let mealsToExport = order.residentMeals;
    if (residentId) {
      mealsToExport = order.residentMeals.filter(rm => rm.residentId === residentId);
    }

    const workbook = new ExcelJS.Workbook();
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

    const worksheet = workbook.addWorksheet('Meal Orders');
    worksheetData.forEach(row => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="nursing-home-order-${order.orderNumber}.xlsx"`);
    res.send(Buffer.from(buffer));

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

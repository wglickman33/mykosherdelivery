const express = require('express');
const { NursingHomeResidentOrder, NursingHomeResident, NursingHomeFacility, Profile } = require('../models');
const { requireAdmin, requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const XLSX = require('xlsx');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Helper function to calculate Sunday 12 PM deadline for a given week
function calculateDeadline(weekStartDate) {
  const startDate = new Date(weekStartDate);
  // Get the Sunday before the week starts (week starts on Monday)
  const sunday = new Date(startDate);
  sunday.setDate(startDate.getDate() - 1); // Go back to Sunday
  sunday.setHours(12, 0, 0, 0); // Set to 12:00 PM
  return sunday;
}

// Helper function to generate order number
function generateOrderNumber() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `NH-RES-${timestamp}-${random}`.toUpperCase();
}

// Helper function to calculate order totals
function calculateOrderTotals(meals) {
  let totalMeals = 0;
  let subtotal = 0;

  const mealPrices = {
    breakfast: 15.00,
    lunch: 21.00,
    dinner: 23.00
  };

  meals.forEach(meal => {
    totalMeals++;
    subtotal += mealPrices[meal.mealType] || 0;
  });

  const tax = subtotal * 0.08875; // NY tax rate
  const total = subtotal + tax;

  return {
    totalMeals,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

// GET /api/nursing-homes/resident-orders - List orders for a resident
router.get('/resident-orders', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, residentId, status, paymentStatus, weekStartDate } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Filter by resident
    if (residentId) {
      where.residentId = residentId;
      
      // Verify user has access to this resident
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
      // Get all residents assigned to this user
      const residents = await NursingHomeResident.findAll({
        where: { assignedUserId: req.user.id },
        attributes: ['id']
      });
      where.residentId = residents.map(r => r.id);
    }

    // Filter by facility for NH admin
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

// POST /api/nursing-homes/resident-orders - Create draft order for a resident (can be edited until Sunday)
router.post('/resident-orders', requireNursingHomeUser, [
  body('residentId').isUUID(),
  body('weekStartDate').isDate(),
  body('weekEndDate').isDate(),
  body('meals').isArray(),
  body('deliveryAddress').isObject()
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

    const { residentId, weekStartDate, weekEndDate, meals, deliveryAddress, billingEmail, billingName } = req.body;

    // Verify resident exists and user has access
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

    // Check access permissions
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

    // Calculate deadline
    const deadline = calculateDeadline(weekStartDate);

    // Calculate totals
    const totals = calculateOrderTotals(meals);

    // Generate order number
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

// PUT /api/nursing-homes/resident-orders/:id - Update draft order (before Sunday deadline)
router.put('/resident-orders/:id', requireNursingHomeUser, [
  body('meals').optional().isArray(),
  body('billingEmail').optional().isEmail(),
  body('billingName').optional().isString()
], async (req, res) => {
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

    // Check access permissions
    if (req.user.role === 'nursing_home_user') {
      if (order.resident.assignedUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    // Can only edit draft orders
    if (order.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Can only edit draft orders',
        message: 'Order has already been submitted'
      });
    }

    // Check if past deadline
    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    // Update meals and recalculate totals if meals changed
    const updateData = {};
    if (meals) {
      updateData.meals = meals;
      const totals = calculateOrderTotals(meals);
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

// POST /api/nursing-homes/resident-orders/:id/submit-and-pay - Submit order and process payment (Sunday deadline)
router.post('/resident-orders/:id/submit-and-pay', requireNursingHomeUser, [
  body('paymentMethodId').optional().isString()
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

    // Check access permissions
    if (req.user.role === 'nursing_home_user') {
      if (order.resident.assignedUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    // Check if already submitted
    if (order.status === 'submitted' || order.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order already submitted'
      });
    }

    // Check if past deadline (Sunday 12 PM)
    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot submit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM. Contact admin for assistance.'
      });
    }

    // Process payment with Stripe - resident will be charged and receive receipt
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.total * 100), // Convert to cents
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
        receipt_email: order.billingEmail, // Receipt sent directly to resident/family
        statement_descriptor: 'MKD MEALS' // Shows on credit card statement
      });

      // Update order
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
      
      // Update order to failed payment
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

// GET /api/nursing-homes/resident-orders/:id/export - Export order
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

    // Check access permissions
    if (req.user.role === 'nursing_home_user') {
      if (order.resident.assignedUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Add header
    worksheetData.push(['Weekly Meal Order']);
    worksheetData.push(['Resident:', order.residentName]);
    worksheetData.push(['Room:', order.roomNumber || 'N/A']);
    worksheetData.push(['Order Number:', order.orderNumber]);
    worksheetData.push(['Week:', `${order.weekStartDate} to ${order.weekEndDate}`]);
    worksheetData.push(['Total:', `$${order.total}`]);
    worksheetData.push(['Payment Status:', order.paymentStatus]);
    worksheetData.push([]);
    worksheetData.push(['Day', 'Meal Type', 'Items', 'Bagel Type', 'Price']);

    // Add meal data
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

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers and send file
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

module.exports = router;

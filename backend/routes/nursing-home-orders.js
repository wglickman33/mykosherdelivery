const express = require('express');
const { NursingHomeOrder, NursingHomeFacility, Profile } = require('../models');
const { requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const XLSX = require('xlsx');

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
  return `NH-${timestamp}-${random}`.toUpperCase();
}

// Helper function to calculate order totals
function calculateOrderTotals(residentMeals) {
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

  const tax = subtotal * 0.08875; // NY tax rate
  const total = subtotal + tax;

  return {
    totalMeals,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

// GET /api/nursing-homes/orders - List orders
router.get('/orders', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, facilityId, weekStartDate } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Filter by facility based on user role
    if (req.user.role === 'nursing_home_user' || req.user.role === 'nursing_home_admin') {
      if (req.user.role !== 'admin') {
        where.facilityId = req.user.nursingHomeFacilityId;
      } else if (facilityId) {
        where.facilityId = facilityId;
      }
    } else if (facilityId) {
      where.facilityId = facilityId;
    }

    // Nursing home users can only see orders they created
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

// GET /api/nursing-homes/orders/:id - Get order details
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

    // Check access permissions
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

// POST /api/nursing-homes/orders - Create/draft order
router.post('/orders', requireNursingHomeUser, [
  body('facilityId').isUUID(),
  body('weekStartDate').isDate(),
  body('weekEndDate').isDate(),
  body('residentMeals').isArray(),
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

    const { facilityId, weekStartDate, weekEndDate, residentMeals, deliveryAddress } = req.body;

    // Check facility access
    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Verify facility exists
    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    // Calculate deadline
    const deadline = calculateDeadline(weekStartDate);

    // Calculate totals
    const totals = calculateOrderTotals(residentMeals);

    // Generate order number
    const orderNumber = generateOrderNumber();

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

// PUT /api/nursing-homes/orders/:id - Update order (before deadline)
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

    // Check access permissions
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

    // Check if order is past deadline (only admin can edit after deadline)
    const now = new Date();
    if (now > order.deadline && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    // Check if order is already submitted (only admin can edit submitted orders)
    if (order.status === 'submitted' && req.user.role !== 'admin' && req.user.role !== 'nursing_home_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit submitted order'
      });
    }

    // Recalculate totals if residentMeals changed
    if (updateData.residentMeals) {
      const totals = calculateOrderTotals(updateData.residentMeals);
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

// POST /api/nursing-homes/orders/:id/submit - Submit order (locks it)
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

    // Check access permissions
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

    // Check if already submitted
    if (order.status === 'submitted') {
      return res.status(400).json({
        success: false,
        error: 'Order already submitted'
      });
    }

    // Check if past deadline
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

// DELETE /api/nursing-homes/orders/:id - Cancel order
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

    // Check access permissions
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

// GET /api/nursing-homes/orders/:id/export - Export order for resident
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

    // Check access permissions
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

    // Filter meals for specific resident if requested
    let mealsToExport = order.residentMeals;
    if (residentId) {
      mealsToExport = order.residentMeals.filter(rm => rm.residentId === residentId);
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Add header
    worksheetData.push(['Nursing Home Meal Order']);
    worksheetData.push(['Facility:', order.facility.name]);
    worksheetData.push(['Order Number:', order.orderNumber]);
    worksheetData.push(['Week:', `${order.weekStartDate} to ${order.weekEndDate}`]);
    worksheetData.push([]);
    worksheetData.push(['Resident', 'Room', 'Day', 'Meal Type', 'Main/Entree', 'Side/Soup', 'Dessert', 'Bagel Type', 'Special Notes']);

    // Add meal data
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

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers and send file
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

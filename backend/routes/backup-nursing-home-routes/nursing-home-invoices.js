const express = require('express');
const { NursingHomeInvoice, NursingHomeFacility, NursingHomeOrder } = require('../models');
const { requireAdmin, requireNursingHomeAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

// Helper function to generate invoice number
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-NH-${year}${month}-${random}`;
}

// GET /api/nursing-homes/invoices - List invoices
router.get('/invoices', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, facilityId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Filter by facility based on user role
    if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    } else if (facilityId) {
      where.facilityId = facilityId;
    }

    if (status) {
      where.status = status;
    }

    const { count, rows: invoices } = await NursingHomeInvoice.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address', 'contactEmail']
        }
      ]
    });

    res.json({
      success: true,
      data: invoices,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices',
      message: error.message
    });
  }
});

// GET /api/nursing-homes/invoices/:id - Get invoice details
router.get('/invoices/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await NursingHomeInvoice.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address', 'contactEmail', 'contactPhone', 'billingFrequency']
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && invoice.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Fetch associated orders
    const orders = await NursingHomeOrder.findAll({
      where: {
        id: invoice.orderIds
      },
      attributes: ['id', 'orderNumber', 'weekStartDate', 'weekEndDate', 'totalMeals', 'subtotal', 'tax', 'total']
    });

    res.json({
      success: true,
      data: {
        ...invoice.toJSON(),
        orders
      }
    });
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice',
      message: error.message
    });
  }
});

// POST /api/nursing-homes/invoices/generate - Generate invoice (admin only)
router.post('/invoices/generate', requireAdmin, [
  body('facilityId').isUUID(),
  body('billingPeriodStart').isDate(),
  body('billingPeriodEnd').isDate(),
  body('dueDate').optional().isDate()
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

    const { facilityId, billingPeriodStart, billingPeriodEnd, dueDate } = req.body;

    // Verify facility exists
    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    // Find all submitted orders for this facility in the billing period
    const orders = await NursingHomeOrder.findAll({
      where: {
        facilityId,
        status: 'submitted',
        weekStartDate: {
          [require('sequelize').Op.gte]: billingPeriodStart
        },
        weekEndDate: {
          [require('sequelize').Op.lte]: billingPeriodEnd
        }
      }
    });

    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No submitted orders found for this period'
      });
    }

    // Calculate totals
    let totalMeals = 0;
    let subtotal = 0;
    let tax = 0;
    const orderIds = [];

    orders.forEach(order => {
      totalMeals += order.totalMeals;
      subtotal += parseFloat(order.subtotal);
      tax += parseFloat(order.tax);
      orderIds.push(order.id);
    });

    const total = subtotal + tax;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Calculate due date if not provided (30 days from now)
    const calculatedDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await NursingHomeInvoice.create({
      facilityId,
      invoiceNumber,
      billingPeriodStart,
      billingPeriodEnd,
      orderIds,
      totalMeals,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      status: 'draft',
      dueDate: calculatedDueDate
    });

    logger.info('Invoice generated', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      facilityId,
      orderCount: orders.length,
      generatedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate invoice',
      message: error.message
    });
  }
});

// PUT /api/nursing-homes/invoices/:id - Update invoice (admin only)
router.put('/invoices/:id', requireAdmin, [
  body('dueDate').optional().isDate(),
  body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
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

    const invoice = await NursingHomeInvoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    await invoice.update(updateData);

    logger.info('Invoice updated', {
      invoiceId: invoice.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update invoice',
      message: error.message
    });
  }
});

// POST /api/nursing-homes/invoices/:id/send - Send invoice to facility (admin only)
router.post('/invoices/:id/send', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await NursingHomeInvoice.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility'
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    if (invoice.status === 'sent') {
      return res.status(400).json({
        success: false,
        error: 'Invoice already sent'
      });
    }

    await invoice.update({ status: 'sent' });

    // TODO: Send email to facility with invoice
    // This would integrate with your email service

    logger.info('Invoice sent', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      facilityId: invoice.facilityId,
      sentBy: req.user.id
    });

    res.json({
      success: true,
      data: invoice,
      message: 'Invoice sent successfully'
    });
  } catch (error) {
    logger.error('Error sending invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invoice',
      message: error.message
    });
  }
});

// POST /api/nursing-homes/invoices/:id/mark-paid - Mark invoice as paid (admin only)
router.post('/invoices/:id/mark-paid', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await NursingHomeInvoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Invoice already marked as paid'
      });
    }

    await invoice.update({
      status: 'paid',
      paidAt: new Date()
    });

    logger.info('Invoice marked as paid', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      markedBy: req.user.id
    });

    res.json({
      success: true,
      data: invoice,
      message: 'Invoice marked as paid'
    });
  } catch (error) {
    logger.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark invoice as paid',
      message: error.message
    });
  }
});

module.exports = router;

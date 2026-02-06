const express = require('express');
const { NursingHomeFacility, NursingHomeResident, NursingHomeMenuItem, NursingHomeInvoice, NursingHomeOrder, Profile } = require('../models');
const { requireAdmin, requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/facilities', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', isActive } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.name = { [require('sequelize').Op.iLike]: `%${search}%` };
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const { count, rows: facilities } = await NursingHomeFacility.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']],
      include: [
        {
          model: Profile,
          as: 'staff',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }
      ]
    });

    res.json({
      success: true,
      data: facilities,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching nursing home facilities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch facilities',
      message: error.message
    });
  }
});

router.get('/facilities/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const facility = await NursingHomeFacility.findByPk(id, {
      include: [
        {
          model: Profile,
          as: 'staff',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'phone']
        }
      ]
    });

    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facility.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error fetching facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch facility',
      message: error.message
    });
  }
});

router.post('/facilities', requireAdmin, [
  body('name').notEmpty().trim(),
  body('address').isObject(),
  body('address.street').notEmpty(),
  body('address.city').notEmpty(),
  body('address.state').notEmpty(),
  body('address.zip_code').notEmpty(),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional(),
  body('billingFrequency').optional().isIn(['weekly', 'monthly'])
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

    const { name, address, contactEmail, contactPhone, billingFrequency } = req.body;

    const facility = await NursingHomeFacility.create({
      name,
      address,
      contactEmail,
      contactPhone,
      billingFrequency: billingFrequency || 'monthly',
      isActive: true
    });

    logger.info('Nursing home facility created', {
      facilityId: facility.id,
      name: facility.name,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error creating facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create facility',
      message: error.message
    });
  }
});

router.put('/facilities/:id', requireAdmin, [
  body('name').optional().notEmpty().trim(),
  body('address').optional().isObject(),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional(),
  body('billingFrequency').optional().isIn(['weekly', 'monthly']),
  body('isActive').optional().isBoolean()
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

    const facility = await NursingHomeFacility.findByPk(id);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    await facility.update(updateData);

    logger.info('Nursing home facility updated', {
      facilityId: facility.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error updating facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update facility',
      message: error.message
    });
  }
});

router.delete('/facilities/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const facility = await NursingHomeFacility.findByPk(id);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    await facility.update({ isActive: false });

    logger.info('Nursing home facility deactivated', {
      facilityId: facility.id,
      deactivatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Facility deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate facility',
      message: error.message
    });
  }
});

router.get('/residents', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', facilityId, assignedUserId, isActive } = req.query;
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
      where.assignedUserId = req.user.id;
    } else if (assignedUserId) {
      where.assignedUserId = assignedUserId;
    }

    if (search) {
      where.name = { [require('sequelize').Op.iLike]: `%${search}%` };
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const { count, rows: residents } = await NursingHomeResident.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']],
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name']
        },
        {
          model: Profile,
          as: 'assignedUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: residents,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
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
    const { id } = req.params;

    const resident = await NursingHomeResident.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address']
        },
        {
          model: Profile,
          as: 'assignedUser',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
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

    res.json({
      success: true,
      data: resident
    });
  } catch (error) {
    logger.error('Error fetching resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resident',
      message: error.message
    });
  }
});

router.post('/residents', requireNursingHomeAdmin, [
  body('facilityId').isUUID(),
  body('name').notEmpty().trim(),
  body('roomNumber').optional().trim(),
  body('dietaryRestrictions').optional().trim(),
  body('allergies').optional().trim(),
  body('notes').optional().trim(),
  body('assignedUserId').optional().isUUID()
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

    const { facilityId, name, roomNumber, dietaryRestrictions, allergies, notes, assignedUserId } = req.body;

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

    if (assignedUserId) {
      const assignedUser = await Profile.findByPk(assignedUserId);
      if (!assignedUser || assignedUser.nursingHomeFacilityId !== facilityId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid assigned user'
        });
      }
    }

    const resident = await NursingHomeResident.create({
      facilityId,
      name,
      roomNumber,
      dietaryRestrictions,
      allergies,
      notes,
      assignedUserId,
      isActive: true
    });

    logger.info('Resident created', {
      residentId: resident.id,
      facilityId,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: resident
    });
  } catch (error) {
    logger.error('Error creating resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create resident',
      message: error.message
    });
  }
});

router.put('/residents/:id', requireNursingHomeAdmin, [
  body('name').optional().notEmpty().trim(),
  body('roomNumber').optional().trim(),
  body('dietaryRestrictions').optional().trim(),
  body('allergies').optional().trim(),
  body('notes').optional().trim(),
  body('assignedUserId').optional().isUUID(),
  body('isActive').optional().isBoolean()
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

    const resident = await NursingHomeResident.findByPk(id);
    if (!resident) {
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role !== 'admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (updateData.assignedUserId) {
      const assignedUser = await Profile.findByPk(updateData.assignedUserId);
      if (!assignedUser || assignedUser.nursingHomeFacilityId !== resident.facilityId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid assigned user'
        });
      }
    }

    await resident.update(updateData);

    logger.info('Resident updated', {
      residentId: resident.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: resident
    });
  } catch (error) {
    logger.error('Error updating resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resident',
      message: error.message
    });
  }
});

router.post('/residents/:id/assign', requireNursingHomeAdmin, [
  body('assignedUserId').isUUID()
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
    const { assignedUserId } = req.body;

    const resident = await NursingHomeResident.findByPk(id);
    if (!resident) {
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role !== 'admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const assignedUser = await Profile.findByPk(assignedUserId);
    if (!assignedUser || assignedUser.nursingHomeFacilityId !== resident.facilityId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assigned user'
      });
    }

    await resident.update({ assignedUserId });

    logger.info('Resident assigned', {
      residentId: resident.id,
      assignedUserId,
      assignedBy: req.user.id
    });

    res.json({
      success: true,
      data: resident
    });
  } catch (error) {
    logger.error('Error assigning resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign resident',
      message: error.message
    });
  }
});

router.delete('/residents/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const resident = await NursingHomeResident.findByPk(id);
    if (!resident) {
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role !== 'admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await resident.update({ isActive: false });

    logger.info('Resident deactivated', {
      residentId: resident.id,
      deactivatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Resident deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate resident',
      message: error.message
    });
  }
});

router.get('/menu', requireNursingHomeUser, async (req, res) => {
  try {
    const { mealType, category, isActive = 'true' } = req.query;

    const where = { isActive: isActive === 'true' };
    if (mealType) {
      where.mealType = mealType;
    }
    if (category) {
      where.category = category;
    }

    const menuItems = await NursingHomeMenuItem.findAll({
      where,
      order: [['mealType', 'ASC'], ['category', 'ASC'], ['displayOrder', 'ASC']]
    });

    const groupedMenu = {
      breakfast: {
        main: [],
        side: []
      },
      lunch: {
        entree: [],
        side: []
      },
      dinner: {
        entree: [],
        side: [],
        soup: [],
        dessert: []
      }
    };

    menuItems.forEach(item => {
      if (groupedMenu[item.mealType] && groupedMenu[item.mealType][item.category]) {
        groupedMenu[item.mealType][item.category].push(item);
      }
    });

    res.json({
      success: true,
      data: {
        items: menuItems,
        grouped: groupedMenu
      }
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
    const { id } = req.params;

    const menuItem = await NursingHomeMenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    logger.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item',
      message: error.message
    });
  }
});

router.post('/menu', requireAdmin, [
  body('mealType').isIn(['breakfast', 'lunch', 'dinner']),
  body('category').isIn(['main', 'side', 'entree', 'dessert', 'soup']),
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('price').isDecimal(),
  body('requiresBagelType').optional().isBoolean(),
  body('excludesSide').optional().isBoolean(),
  body('displayOrder').optional().isInt()
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

    const menuItem = await NursingHomeMenuItem.create(req.body);

    logger.info('Menu item created', {
      menuItemId: menuItem.id,
      name: menuItem.name,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    logger.error('Error creating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create menu item',
      message: error.message
    });
  }
});

router.put('/menu/:id', requireAdmin, [
  body('mealType').optional().isIn(['breakfast', 'lunch', 'dinner']),
  body('category').optional().isIn(['main', 'side', 'entree', 'dessert', 'soup']),
  body('name').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('price').optional().isDecimal(),
  body('requiresBagelType').optional().isBoolean(),
  body('excludesSide').optional().isBoolean(),
  body('displayOrder').optional().isInt(),
  body('isActive').optional().isBoolean()
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

    const menuItem = await NursingHomeMenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    await menuItem.update(req.body);

    logger.info('Menu item updated', {
      menuItemId: menuItem.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    logger.error('Error updating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update menu item',
      message: error.message
    });
  }
});

router.delete('/menu/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await NursingHomeMenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    await menuItem.update({ isActive: false });

    logger.info('Menu item deactivated', {
      menuItemId: menuItem.id,
      deactivatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Menu item deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate menu item',
      message: error.message
    });
  }
});

function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-NH-${year}${month}-${random}`;
}

router.get('/invoices', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, facilityId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

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

    if (req.user.role !== 'admin' && invoice.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

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

    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

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
    const invoiceNumber = generateInvoiceNumber();
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

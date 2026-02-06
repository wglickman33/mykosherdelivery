const express = require('express');
const { NursingHomeFacility, Profile } = require('../models');
const { requireAdmin, requireNursingHomeAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/nursing-homes/facilities - List all facilities (admin only)
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

// GET /api/nursing-homes/facilities/:id - Get facility details
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

    // Check if user has access (admin or belongs to this facility)
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

// POST /api/nursing-homes/facilities - Create new facility (admin only)
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

// PUT /api/nursing-homes/facilities/:id - Update facility (admin only)
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

// DELETE /api/nursing-homes/facilities/:id - Deactivate facility (admin only)
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

module.exports = router;

const express = require('express');
const { NursingHomeResident, NursingHomeFacility, Profile } = require('../models');
const { requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

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

module.exports = router;

const express = require('express');
const { NursingHomeMenuItem } = require('../models');
const { requireAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/nursing-homes/menu - Get all menu items (optionally filtered by meal type)
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

    // Group by meal type and category
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

// GET /api/nursing-homes/menu/:id - Get menu item details
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

// POST /api/nursing-homes/menu - Create menu item (admin only)
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

// PUT /api/nursing-homes/menu/:id - Update menu item (admin only)
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

// DELETE /api/nursing-homes/menu/:id - Delete menu item (admin only)
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

module.exports = router;

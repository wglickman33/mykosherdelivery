const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { KiddushPackage, KiddushMenuItem } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { logAdminAction } = require('../utils/auditLog');
const { validateMenuItemData, normalizeMenuItemData } = require('../utils/menuItemValidation');

const router = express.Router({ mergeParams: true });

const toJson = (row) => {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    id: j.id,
    kiddushPackageId: j.kiddushPackageId ?? j.kiddush_package_id,
    name: j.name,
    description: j.description ?? null,
    price: parseFloat(j.price),
    category: j.category,
    imageUrl: j.imageUrl ?? j.image_url ?? null,
    available: j.available !== false,
    featured: j.featured === true,
    itemType: j.itemType ?? j.item_type ?? 'simple',
    options: j.options ?? null,
    labels: Array.isArray(j.labels) ? j.labels : [],
    displayOrder: j.displayOrder ?? j.display_order ?? 0,
    createdAt: j.createdAt ?? j.created_at,
    updatedAt: j.updatedAt ?? j.updated_at
  };
};

const imageUrlValidator = body('imageUrl').optional().custom((value) => {
  if (!value || String(value).trim() === '') return true;
  if (value.startsWith('images/') || value.startsWith('/images/')) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}).withMessage('Image URL must be a valid URL or an uploaded image path');

const boolValidator = (field) => body(field).optional().custom((value) =>
  value === true || value === false || value === 'true' || value === 'false' || value === 1 || value === 0
).withMessage(`${field} must be a boolean value`);

async function loadPackage(packageId) {
  return KiddushPackage.findByPk(packageId);
}

router.get('/', requireAdmin, [
  query('category').optional().isString(),
  query('available').optional().isIn(['true', 'false', '1', '0']),
  query('itemType').optional().isIn(['simple', 'variety', 'builder', 'all']),
  query('search').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const pkg = await loadPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    const where = { kiddushPackageId: pkg.id };
    if (req.query.category && req.query.category !== 'all') {
      where.category = req.query.category;
    }
    if (req.query.available === 'true' || req.query.available === '1') {
      where.available = true;
    } else if (req.query.available === 'false' || req.query.available === '0') {
      where.available = false;
    }
    if (req.query.itemType && req.query.itemType !== 'all') {
      where.itemType = req.query.itemType;
    }
    if (req.query.search) {
      const term = `%${req.query.search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: term } },
        { category: { [Op.iLike]: term } },
        { description: { [Op.iLike]: term } }
      ];
    }

    const limit = req.query.limit != null ? req.query.limit : 100;
    const offset = req.query.offset != null ? req.query.offset : 0;

    const { count, rows } = await KiddushMenuItem.findAndCountAll({
      where,
      order: [['displayOrder', 'ASC'], ['category', 'ASC'], ['name', 'ASC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: rows.map(toJson),
      pagination: {
        total: count,
        limit,
        offset,
        totalPages: Math.ceil(count / limit) || 1
      }
    });
  } catch (err) {
    logger.error('Admin kiddush menu items list error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to list menu items' });
  }
});

router.get('/:itemId', requireAdmin, [param('itemId').isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const row = await KiddushMenuItem.findOne({
      where: { id: req.params.itemId, kiddushPackageId: req.params.packageId }
    });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }
    res.json({ success: true, data: toJson(row) });
  } catch (err) {
    logger.error('Admin kiddush menu item get error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to get menu item' });
  }
});

router.post('/', requireAdmin, [
  body('name').notEmpty().trim().isLength({ min: 1, max: 255 }),
  body('itemType').isIn(['simple', 'variety', 'builder']),
  body('price').custom((value) => {
    const numValue = parseFloat(value);
    return !Number.isNaN(numValue) && numValue >= 0;
  }).withMessage('Price must be a valid number >= 0'),
  body('category').notEmpty().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  imageUrlValidator,
  boolValidator('available'),
  boolValidator('featured'),
  body('options').optional().custom((value) =>
    value === null || value === undefined || typeof value === 'object'
  ),
  body('labels').optional().custom((value) =>
    value === null || value === undefined || Array.isArray(value)
  ),
  body('displayOrder').optional().isInt({ min: 0, max: 9999 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const pkg = await loadPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    const validationErrors = validateMenuItemData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Menu item validation failed', details: validationErrors });
    }

    const normalizedData = normalizeMenuItemData(req.body);
    const row = await KiddushMenuItem.create({
      ...normalizedData,
      kiddushPackageId: pkg.id,
      displayOrder: req.body.displayOrder != null ? req.body.displayOrder : 0
    });

    try {
      await logAdminAction(req.user.id, 'CREATE', 'kiddush_menu_items', row.id, null, toJson(row), req);
    } catch (e) {
      logger.warn('kiddush menu item audit log failed', e);
    }

    res.status(201).json({ success: true, data: toJson(row), message: 'Menu item created successfully' });
  } catch (err) {
    logger.error('Admin kiddush menu item create error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to create menu item' });
  }
});

router.put('/:itemId', requireAdmin, [
  param('itemId').isUUID(),
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('itemType').optional().isIn(['simple', 'variety', 'builder']),
  body('price').optional().custom((value) => {
    const numValue = parseFloat(value);
    return !Number.isNaN(numValue) && numValue >= 0;
  }),
  body('category').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  imageUrlValidator,
  boolValidator('available'),
  boolValidator('featured'),
  body('options').optional().custom((value) =>
    value === null || value === undefined || typeof value === 'object'
  ),
  body('labels').optional().custom((value) =>
    value === null || value === undefined || Array.isArray(value)
  ),
  body('displayOrder').optional().isInt({ min: 0, max: 9999 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const row = await KiddushMenuItem.findOne({
      where: { id: req.params.itemId, kiddushPackageId: req.params.packageId }
    });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const old = row.toJSON();
    const merged = {
      name: req.body.name != null ? req.body.name : row.name,
      description: req.body.description !== undefined ? req.body.description : row.description,
      price: req.body.price != null ? req.body.price : row.price,
      category: req.body.category != null ? req.body.category : row.category,
      imageUrl: req.body.imageUrl !== undefined ? req.body.imageUrl : row.imageUrl,
      available: req.body.available !== undefined ? req.body.available : row.available,
      featured: req.body.featured !== undefined ? req.body.featured : row.featured,
      itemType: req.body.itemType != null ? req.body.itemType : row.itemType,
      options: req.body.options !== undefined ? req.body.options : row.options,
      labels: req.body.labels !== undefined ? req.body.labels : row.labels
    };

    const validationErrors = validateMenuItemData(merged);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Menu item validation failed', details: validationErrors });
    }

    const normalizedData = normalizeMenuItemData(merged);
    await row.update({
      ...normalizedData,
      ...(req.body.displayOrder != null && { displayOrder: req.body.displayOrder })
    });

    try {
      await logAdminAction(req.user.id, 'UPDATE', 'kiddush_menu_items', row.id, old, row.toJSON(), req);
    } catch (e) {
      logger.warn('kiddush menu item audit log failed', e);
    }

    await row.reload();
    res.json({ success: true, data: toJson(row), message: 'Menu item updated successfully' });
  } catch (err) {
    logger.error('Admin kiddush menu item update error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to update menu item' });
  }
});

router.delete('/:itemId', requireAdmin, [param('itemId').isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const row = await KiddushMenuItem.findOne({
      where: { id: req.params.itemId, kiddushPackageId: req.params.packageId }
    });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const old = row.toJSON();
    await row.destroy();

    try {
      await logAdminAction(req.user.id, 'DELETE', 'kiddush_menu_items', row.id, old, null, req);
    } catch (e) {
      logger.warn('kiddush menu item audit log failed', e);
    }

    res.json({ success: true, message: 'Menu item deleted' });
  } catch (err) {
    logger.error('Admin kiddush menu item delete error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to delete menu item' });
  }
});

router.post('/:itemId/duplicate', requireAdmin, [param('itemId').isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const existingItem = await KiddushMenuItem.findOne({
      where: { id: req.params.itemId, kiddushPackageId: req.params.packageId },
      include: [{ model: KiddushPackage, as: 'package', attributes: ['id', 'name'] }]
    });
    if (!existingItem) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const sourceName = (existingItem.name || '').trim();
    const baseName = sourceName.replace(/\s+\d+$/, '').trim() || sourceName;
    const allSamePackage = await KiddushMenuItem.findAll({
      where: { kiddushPackageId: req.params.packageId },
      attributes: ['name']
    });

    let maxNum = 0;
    const exactBase = baseName.toLowerCase();
    for (const row of allSamePackage) {
      const n = (row.name || '').trim();
      if (n.toLowerCase() === exactBase) {
        maxNum = Math.max(maxNum, 1);
      } else if (n.toLowerCase().startsWith(`${exactBase} `)) {
        const suffix = n.slice(baseName.length).trim();
        const num = parseInt(suffix, 10);
        if (String(num) === suffix && num >= 1) {
          maxNum = Math.max(maxNum, num);
        }
      }
    }

    const newName = `${baseName} ${maxNum + 1}`;
    const optionsClone = existingItem.options != null && typeof existingItem.options === 'object'
      ? JSON.parse(JSON.stringify(existingItem.options))
      : undefined;
    const labelsClone = Array.isArray(existingItem.labels)
      ? JSON.parse(JSON.stringify(existingItem.labels))
      : [];

    const payload = {
      name: newName,
      description: existingItem.description ?? null,
      price: existingItem.price,
      category: existingItem.category,
      imageUrl: existingItem.imageUrl ?? null,
      available: existingItem.available !== false,
      featured: existingItem.featured === true,
      itemType: existingItem.itemType || 'simple',
      options: optionsClone,
      labels: labelsClone
    };

    const validationErrors = validateMenuItemData(payload);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Duplicated menu item validation failed', details: validationErrors });
    }

    const normalizedData = normalizeMenuItemData(payload);
    const row = await KiddushMenuItem.create({
      ...normalizedData,
      kiddushPackageId: req.params.packageId,
      displayOrder: existingItem.displayOrder ?? 0
    });

    try {
      await logAdminAction(req.user.id, 'CREATE', 'kiddush_menu_items', row.id, null, {
        ...toJson(row),
        duplicatedFrom: existingItem.id
      }, req);
    } catch (e) {
      logger.warn('kiddush menu item audit log failed', e);
    }

    res.status(201).json({
      success: true,
      data: toJson(row),
      message: `Menu item duplicated as "${newName}"`
    });
  } catch (err) {
    logger.error('Admin kiddush menu item duplicate error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to duplicate menu item' });
  }
});

module.exports = router;

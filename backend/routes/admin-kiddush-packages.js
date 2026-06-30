const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { KiddushPackage, KiddushMenuItem } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { logAdminAction } = require('../utils/auditLog');

const router = express.Router();

const CATEGORIES = ['kiddush', 'shalom_zachor'];
const SIZE_TIERS = ['8_12', '15_20', '25_plus'];

const toAdminJson = (row) => {
  const j = row.toJSON ? row.toJSON() : row;
  const menuItemCount = Array.isArray(j.menuItems) ? j.menuItems.length : 0;
  return {
    id: j.id,
    category: j.category,
    sizeTier: j.sizeTier ?? j.size_tier,
    name: j.name,
    price: parseFloat(j.price),
    shortDescription: j.shortDescription ?? j.short_description ?? null,
    includedItems: Array.isArray(j.includedItems) ? j.includedItems : (j.included_items || []),
    imageUrl: j.imageUrl ?? j.image_url ?? null,
    isActive: j.isActive ?? j.is_active,
    displayOrder: j.displayOrder ?? j.display_order ?? 0,
    menuItemCount,
    createdAt: j.createdAt ?? j.created_at,
    updatedAt: j.updatedAt ?? j.updated_at
  };
};

const parseIncludedItems = (value) => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const p = JSON.parse(value);
      return Array.isArray(p) ? p.map((s) => String(s).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

router.get('/', requireAdmin, [
  query('includeInactive').optional().isIn(['true', 'false', '1', '0'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const where = includeInactive ? {} : { isActive: true };
    const rows = await KiddushPackage.findAll({
      where,
      include: [{
        model: KiddushMenuItem,
        as: 'menuItems',
        attributes: ['id'],
        required: false
      }],
      order: [
        ['category', 'ASC'],
        ['displayOrder', 'ASC'],
        ['sizeTier', 'ASC']
      ]
    });
    res.json({ success: true, data: rows.map(toAdminJson) });
  } catch (err) {
    logger.error('Admin kiddush packages list error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to list packages' });
  }
});

router.get('/:id', requireAdmin, [param('id').isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const row = await KiddushPackage.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Package not found' });
    res.json({ success: true, data: toAdminJson(row) });
  } catch (err) {
    logger.error('Admin kiddush package get error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to get package' });
  }
});

router.post('/', requireAdmin, [
  body('category').isIn(CATEGORIES),
  body('sizeTier').isIn(SIZE_TIERS),
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('price').isFloat({ min: 0 }).toFloat(),
  body('shortDescription').optional({ nullable: true }).isString().isLength({ max: 5000 }),
  body('includedItems').optional().custom((v) => Array.isArray(v) || v == null || typeof v === 'string'),
  body('imageUrl').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('displayOrder').optional().isInt({ min: 0, max: 9999 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const existing = await KiddushPackage.findOne({
      where: { category: req.body.category, sizeTier: req.body.sizeTier }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A package with this category and size already exists. Edit the existing row instead.'
      });
    }
    const row = await KiddushPackage.create({
      category: req.body.category,
      sizeTier: req.body.sizeTier,
      name: req.body.name.trim(),
      price: req.body.price,
      shortDescription: req.body.shortDescription != null ? String(req.body.shortDescription).trim() || null : null,
      includedItems: parseIncludedItems(req.body.includedItems),
      imageUrl: req.body.imageUrl != null ? String(req.body.imageUrl).trim() || null : null,
      isActive: req.body.isActive === true,
      displayOrder: req.body.displayOrder != null ? req.body.displayOrder : 0
    });
    try {
      await logAdminAction(req.user.id, 'CREATE', 'kiddush_packages', row.id, null, toAdminJson(row), req);
    } catch (e) { logger.warn('kiddush audit log failed', e); }
    res.status(201).json({ success: true, data: toAdminJson(row) });
  } catch (err) {
    logger.error('Admin kiddush package create error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to create package' });
  }
});

router.put('/:id', requireAdmin, [
  param('id').isUUID(),
  body('category').optional().isIn(CATEGORIES),
  body('sizeTier').optional().isIn(SIZE_TIERS),
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('shortDescription').optional({ nullable: true }).isString().isLength({ max: 5000 }),
  body('includedItems').optional().custom((v) => Array.isArray(v) || v == null || typeof v === 'string'),
  body('imageUrl').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('displayOrder').optional().isInt({ min: 0, max: 9999 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const row = await KiddushPackage.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Package not found' });
    const old = row.toJSON();
    const nextCategory = req.body.category != null ? req.body.category : row.category;
    const nextSize = req.body.sizeTier != null ? req.body.sizeTier : row.sizeTier;
    if (nextCategory !== row.category || nextSize !== row.sizeTier) {
      const clash = await KiddushPackage.findOne({
        where: {
          category: nextCategory,
          sizeTier: nextSize,
          id: { [Op.ne]: row.id }
        }
      });
      if (clash) {
        return res.status(409).json({
          success: false,
          error: 'Another package already uses this category and size combination.'
        });
      }
    }
    await row.update({
      ...(req.body.category != null && { category: req.body.category }),
      ...(req.body.sizeTier != null && { sizeTier: req.body.sizeTier }),
      ...(req.body.name != null && { name: String(req.body.name).trim() }),
      ...(req.body.price != null && { price: req.body.price }),
      ...(req.body.shortDescription !== undefined && {
        shortDescription: req.body.shortDescription != null ? String(req.body.shortDescription).trim() || null : null
      }),
      ...(req.body.includedItems !== undefined && { includedItems: parseIncludedItems(req.body.includedItems) }),
      ...(req.body.imageUrl !== undefined && {
        imageUrl: req.body.imageUrl != null ? String(req.body.imageUrl).trim() || null : null
      }),
      ...(req.body.isActive !== undefined && { isActive: !!req.body.isActive }),
      ...(req.body.displayOrder != null && { displayOrder: req.body.displayOrder })
    });
    try {
      await logAdminAction(req.user.id, 'UPDATE', 'kiddush_packages', row.id, old, row.toJSON(), req);
    } catch (e) { logger.warn('kiddush audit log failed', e); }
    await row.reload();
    res.json({ success: true, data: toAdminJson(row) });
  } catch (err) {
    logger.error('Admin kiddush package update error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to update package' });
  }
});

router.delete('/:id', requireAdmin, [param('id').isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const row = await KiddushPackage.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Package not found' });
    const old = row.toJSON();
    await row.update({ isActive: false });
    try {
      await logAdminAction(req.user.id, 'UPDATE', 'kiddush_packages', row.id, old, row.toJSON(), req);
    } catch (e) { logger.warn('kiddush audit log failed', e); }
    res.json({ success: true, message: 'Package deactivated', data: toAdminJson(row) });
  } catch (err) {
    logger.error('Admin kiddush package delete error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to deactivate package' });
  }
});

module.exports = router;

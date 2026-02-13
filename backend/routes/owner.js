const express = require('express');
const { Op } = require('sequelize');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { Restaurant, MenuItem, MenuItemOption, Order, Profile, sequelize } = require('../models');
const { authenticateToken, requireRestaurantOwnerOrAdmin, requireOwnerContext } = require('../middleware/auth');
const { validateMenuItemData, normalizeMenuItemData } = require('../utils/menuItemValidation');
const { parseBufferAndImport } = require('../utils/menuImport');
const logger = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function buildLogoUrl(req, logoFileName) {
  if (!logoFileName) return null;
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/static/restaurant-logos/${logoFileName}`;
}

function mapOwnerRestaurant(req, restaurantInstance) {
  const r = typeof restaurantInstance.toJSON === 'function' ? restaurantInstance.toJSON() : restaurantInstance;
  const fromInstance = typeof restaurantInstance.get === 'function'
    ? (restaurantInstance.get('logoUrl') || restaurantInstance.get('logo_url'))
    : null;
  const storedFile = fromInstance ?? r.logo_url ?? r.logoUrl ?? null;
  const filenameOnly = storedFile ? String(storedFile).split('/').pop() : null;
  const logoFile = filenameOnly || storedFile || null;
  const logoUrl = logoFile ? buildLogoUrl(req, logoFile) : (r.logoUrl || r.logo_url || null);
  return { ...r, logoUrl, logoFileName: logoFile || undefined };
}

function canAccessRestaurant(req, restaurantId) {
  if (req.user.role === 'admin' && req.ownerRestaurantIds === null) return true;
  return Array.isArray(req.ownerRestaurantIds) && req.ownerRestaurantIds.includes(restaurantId);
}

function orderBelongsToOwner(order, ownerRestaurantIds) {
  if (order.restaurantId && ownerRestaurantIds.includes(order.restaurantId)) return true;
  if (order.restaurantGroups && typeof order.restaurantGroups === 'object') {
    const keys = Object.keys(order.restaurantGroups);
    return keys.some(k => ownerRestaurantIds.includes(k));
  }
  return false;
}

/**
 * Get the slice of an order for a single restaurant: items and subtotal only (no tax, delivery, order total).
 * Used so owners see only their items and their portion subtotal.
 * @param {Object} order - Order plain object (e.g. order.toJSON())
 * @param {string} restaurantId - Restaurant id to slice for
 * @returns {{ items: Array, subtotal: number }}
 */
function getOwnerSlice(order, restaurantId) {
  const d = order;
  if (d.restaurantGroups && d.restaurantGroups[restaurantId]) {
    const group = d.restaurantGroups[restaurantId];
    const items = Array.isArray(group.items) ? group.items : (group.items ? Object.values(group.items) : []);
    let subtotal = 0;
    items.forEach((it) => {
      const lineTotal = it.totalPrice != null ? Number(it.totalPrice) : (Number(it.price || 0) * (Number(it.quantity) || 1));
      subtotal += lineTotal;
    });
    if (group.subtotal != null) subtotal = Number(group.subtotal);
    return { items, subtotal };
  }
  if (d.restaurantId === restaurantId && Array.isArray(d.items)) {
    let subtotal = 0;
    d.items.forEach((it) => {
      const lineTotal = it.totalPrice != null ? Number(it.totalPrice) : (Number(it.price || 0) * (Number(it.quantity) || 1));
      subtotal += lineTotal;
    });
    return { items: d.items, subtotal };
  }
  return { items: [], subtotal: 0 };
}

/**
 * Effective single restaurant id when owner (or admin) is viewing in single-restaurant context.
 * @param {Array<string>|null} ownerRestaurantIds
 * @param {string|undefined} queryRestaurantId
 */
function getEffectiveRestaurantId(ownerRestaurantIds, queryRestaurantId) {
  if (!ownerRestaurantIds || ownerRestaurantIds.length === 0) return null;
  if (queryRestaurantId && ownerRestaurantIds.includes(queryRestaurantId)) return queryRestaurantId;
  if (ownerRestaurantIds.length === 1) return ownerRestaurantIds[0];
  return null;
}

router.use(authenticateToken);
router.use(requireRestaurantOwnerOrAdmin);
router.use(requireOwnerContext);

router.get('/me', async (req, res) => {
  try {
    if (req.user.role === 'admin' && req.ownerRestaurantIds === null) {
      const restaurants = await Restaurant.findAll({
        attributes: ['id', 'name', 'address', 'phone', 'logoUrl', 'active'],
        order: [['name', 'ASC']]
      });
      const mapped = restaurants.map((r) => mapOwnerRestaurant(req, r));
      return res.json({ success: true, data: mapped });
    }
    const restaurantIds = req.ownerRestaurantIds;
    if (!restaurantIds || restaurantIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const restaurants = await Restaurant.findAll({
      where: { id: restaurantIds },
      attributes: ['id', 'name', 'address', 'phone', 'logoUrl', 'active']
    });
    const mapped = restaurants.map((r) => mapOwnerRestaurant(req, r));
    res.json({ success: true, data: mapped });
  } catch (err) {
    logger.error('Owner GET /me', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to load restaurants' });
  }
});

router.get('/restaurants/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!canAccessRestaurant(req, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this restaurant' });
    }
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found', message: 'Restaurant does not exist' });
    }
    const mapped = mapOwnerRestaurant(req, restaurant);
    res.json({ success: true, data: mapped });
  } catch (err) {
    logger.error('Owner GET restaurant', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to load restaurant' });
  }
});

router.get('/restaurants/:restaurantId/menu-items', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!canAccessRestaurant(req, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this restaurant' });
    }
    const { category, available, itemType, search, limit = 50, offset = 0 } = req.query;
    const whereClause = { restaurantId };
    if (category && category !== 'all' && category !== 'undefined') whereClause.category = category;
    if (available !== undefined) whereClause.available = available === 'true';
    if (itemType && itemType !== 'all') whereClause.itemType = itemType;
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }
    const menuItems = await MenuItem.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['name', 'ASC']],
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0,
      include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }]
    });
    const total = await MenuItem.count({ where: whereClause });
    const normalized = menuItems.map(item => {
      const j = item.toJSON();
      if (typeof j.labels === 'string') {
        try { j.labels = JSON.parse(j.labels); } catch { j.labels = []; }
      }
      return j;
    });
    res.json({
      success: true,
      data: normalized,
      pagination: {
        page: Math.floor((parseInt(offset) || 0) / (parseInt(limit) || 50)) + 1,
        limit: parseInt(limit) || 50,
        total,
        totalPages: Math.ceil(total / (parseInt(limit) || 50)),
        offset: parseInt(offset) || 0
      }
    });
  } catch (err) {
    logger.error('Owner GET menu-items', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch menu items' });
  }
});

router.get('/restaurants/:restaurantId/menu-items/:itemId', async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    if (!canAccessRestaurant(req, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this restaurant' });
    }
    const menuItem = await MenuItem.findOne({
      where: { id: itemId, restaurantId },
      include: [
        { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] },
        { model: MenuItemOption, as: 'itemOptions', required: false }
      ]
    });
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found', message: 'Menu item does not exist' });
    }
    const j = menuItem.toJSON();
    if (typeof j.labels === 'string') {
      try { j.labels = JSON.parse(j.labels); } catch { j.labels = []; }
    }
    res.json({ success: true, data: j });
  } catch (err) {
    logger.error('Owner GET menu item', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch menu item' });
  }
});

const menuItemCreateValidation = [
  body('name').notEmpty().trim().isLength({ min: 1, max: 255 }),
  body('itemType').isIn(['simple', 'variety', 'builder']),
  body('price').custom(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0).withMessage('Price must be >= 0'),
  body('category').notEmpty().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('imageUrl').optional().custom(v => !v || v.trim() === '' || (() => { try { new URL(v); return true; } catch { return false; } })()).withMessage('Image URL must be valid'),
  body('available').optional().custom(v => [true, false, 'true', 'false', 1, 0].includes(v)).withMessage('Available must be boolean'),
  body('options').optional().custom(v => v == null || typeof v === 'object').withMessage('Options must be object or null'),
  body('labels').optional().custom(v => v == null || Array.isArray(v)).withMessage('Labels must be array or null')
];

router.post('/restaurants/:restaurantId/menu-items', menuItemCreateValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { restaurantId } = req.params;
    if (!canAccessRestaurant(req, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this restaurant' });
    }
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found', message: 'Restaurant does not exist' });
    }
    const validationErrors = validateMenuItemData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Menu item validation failed', details: validationErrors });
    }
    const normalized = normalizeMenuItemData(req.body);
    const menuItem = await MenuItem.create({ ...normalized, restaurantId });
    res.status(201).json({ success: true, data: menuItem, message: 'Menu item created successfully' });
  } catch (err) {
    logger.error('Owner POST menu item', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to create menu item' });
  }
});

const menuItemUpdateValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('itemType').optional().isIn(['simple', 'variety', 'builder']),
  body('price').optional().custom(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0).withMessage('Price must be >= 0'),
  body('category').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('imageUrl').optional().custom(v => !v || v.trim() === '' || (() => { try { new URL(v); return true; } catch { return false; } })()).withMessage('Image URL must be valid'),
  body('available').optional().custom(v => [true, false, 'true', 'false', 1, 0].includes(v)).withMessage('Available must be boolean'),
  body('options').optional().custom(v => v == null || typeof v === 'object').withMessage('Options must be object or null'),
  body('labels').optional().custom(v => v == null || Array.isArray(v)).withMessage('Labels must be array or null')
];

router.put('/restaurants/:restaurantId/menu-items/:itemId', menuItemUpdateValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { restaurantId, itemId } = req.params;
    if (!canAccessRestaurant(req, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this restaurant' });
    }
    const existing = await MenuItem.findOne({
      where: { id: itemId, restaurantId },
      include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }]
    });
    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found', message: 'Menu item does not exist' });
    }
    const merged = { ...existing.toJSON(), ...req.body };
    const validationErrors = validateMenuItemData(merged);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Menu item validation failed', details: validationErrors });
    }
    const normalized = normalizeMenuItemData(merged);
    await existing.update(normalized);
    res.json({ success: true, data: existing, message: 'Menu item updated successfully' });
  } catch (err) {
    logger.error('Owner PUT menu item', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to update menu item' });
  }
});

router.delete('/restaurants/:restaurantId/menu-items/:itemId', async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    if (!canAccessRestaurant(req, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this restaurant' });
    }
    const existing = await MenuItem.findOne({ where: { id: itemId, restaurantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found', message: 'Menu item does not exist' });
    }
    await existing.destroy();
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (err) {
    logger.error('Owner DELETE menu item', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to delete menu item' });
  }
});

router.post('/restaurants/:restaurantId/menu/import', upload.single('file'), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!canAccessRestaurant(req, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this restaurant' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded', message: 'Use field name "file". Accepts TSV, CSV, or XLSX.' });
    }
    const replace = req.body.replace === 'true' || req.body.replace === true;
    const result = await parseBufferAndImport(
      restaurantId,
      req.file.buffer,
      req.file.mimetype || '',
      req.file.originalname || '',
      { replace }
    );
    res.json({
      success: true,
      ...result,
      message: `Import complete: ${result.created} created, ${result.skipped} skipped${result.replaced ? `, ${result.replaced} replaced` : ''}.`
    });
  } catch (err) {
    logger.error('Owner menu import', { err: err.message });
    res.status(500).json({ error: 'Import failed', message: err.message || 'Failed to import menu' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    let ids = req.ownerRestaurantIds;
    const { restaurantId: queryRestaurantId, status, startDate, endDate, limit = 20, offset = 0 } = req.query;
    if (req.user.role === 'admin' && ids === null) {
      if (queryRestaurantId) ids = [queryRestaurantId];
      else return res.status(400).json({ error: 'Bad request', message: 'Admin must filter by restaurant or use admin orders API' });
    }
    if (!ids || ids.length === 0) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = parseInt(offset) || 0;

    const orConditions = [
      { restaurantId: { [Op.in]: ids } }
    ];
    if (ids.length > 0) {
      const literalIds = ids.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
      orConditions.push(sequelize.literal(`(restaurant_groups IS NOT NULL AND restaurant_groups ?| ARRAY[${literalIds}]::text[])`));
    }
    let whereClause = { [Op.or]: orConditions };
    if (queryRestaurantId && ids.includes(queryRestaurantId)) {
      const oneId = `'${String(queryRestaurantId).replace(/'/g, "''")}'`;
      whereClause = {
        [Op.and]: [
          { [Op.or]: orConditions },
          { [Op.or]: [{ restaurantId: queryRestaurantId }, sequelize.literal(`(restaurant_groups IS NOT NULL AND restaurant_groups ?| ARRAY[${oneId}]::text[])`) ] }
        ]
      };
    }
    if (status && status !== 'all') whereClause.status = status;
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);
    if (Object.keys(dateFilter).length) whereClause.createdAt = dateFilter;

    const include = [
      { model: Profile, as: 'user', attributes: ['firstName', 'lastName', 'email'], required: false },
      { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'], required: false }
    ];
    const { count, rows } = await Order.findAndCountAll({
      where: whereClause,
      include,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: offsetNum
    });
    const effectiveRestaurantId = getEffectiveRestaurantId(ids, queryRestaurantId);
    const enhanced = await Promise.all(rows.map(async (order) => {
      const d = order.toJSON();
      if (d.restaurantGroups && Object.keys(d.restaurantGroups).length > 0) {
        const rids = Object.keys(d.restaurantGroups);
        const restaurants = await Restaurant.findAll({ where: { id: rids }, attributes: ['id', 'name', 'address', 'phone'] });
        d.restaurants = restaurants;
        d.isMultiRestaurant = restaurants.length > 1;
      } else if (d.restaurant) {
        d.restaurants = [d.restaurant];
        d.isMultiRestaurant = false;
      }
      if (effectiveRestaurantId && orderBelongsToOwner(d, ids)) {
        d.ownerSlice = getOwnerSlice(d, effectiveRestaurantId);
      }
      return d;
    }));
    res.json({
      success: true,
      data: enhanced,
      pagination: {
        page: Math.floor(offsetNum / limitNum) + 1,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum)
      }
    });
  } catch (err) {
    logger.error('Owner GET orders', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch orders' });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const ids = req.ownerRestaurantIds;
    const isAdmin = req.user.role === 'admin' && ids === null;
    if (!isAdmin && (ids === null || !ids || ids.length === 0)) {
      return res.status(403).json({ error: 'Forbidden', message: 'No restaurant access' });
    }
    const order = await Order.findByPk(orderId, {
      include: [
        { model: Profile, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false },
        { model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'address', 'phone'], required: false }
      ]
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found', message: 'Order does not exist' });
    }
    const d = order.toJSON();
    if (!isAdmin && !orderBelongsToOwner(d, ids)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this order' });
    }
    if (d.restaurantGroups && Object.keys(d.restaurantGroups).length > 0) {
      const rids = Object.keys(d.restaurantGroups);
      const restaurants = await Restaurant.findAll({ where: { id: rids }, attributes: ['id', 'name', 'address', 'phone'] });
      d.restaurants = restaurants;
      d.isMultiRestaurant = restaurants.length > 1;
    } else if (d.restaurant) {
      d.restaurants = [d.restaurant];
      d.isMultiRestaurant = false;
    }
    const effectiveRestaurantId = getEffectiveRestaurantId(ids || [], req.query.restaurantId);
    if (effectiveRestaurantId && orderBelongsToOwner(d, ids || [])) {
      d.ownerSlice = getOwnerSlice(d, effectiveRestaurantId);
    }
    res.json({ success: true, data: d });
  } catch (err) {
    logger.error('Owner GET order', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch order' });
  }
});

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

router.patch('/orders/:orderId', [
  body('status').optional().isIn(ORDER_STATUSES),
  body('deliveryInstructions').optional().isString().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { orderId } = req.params;
    const ids = req.ownerRestaurantIds;
    const isAdmin = req.user.role === 'admin' && ids === null;
    if (!isAdmin && (ids === null || !ids || ids.length === 0)) {
      return res.status(403).json({ error: 'Forbidden', message: 'No restaurant access' });
    }
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found', message: 'Order does not exist' });
    }
    const d = order.toJSON();
    if (!isAdmin && !orderBelongsToOwner(d, ids)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this order' });
    }
    const allowed = {};
    if (req.body.status !== undefined) allowed.status = req.body.status;
    if (req.body.deliveryInstructions !== undefined) allowed.deliveryInstructions = req.body.deliveryInstructions.trim().substring(0, 500) || null;
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update', message: 'Provide status and/or deliveryInstructions' });
    }
    await order.update(allowed);
    const updated = await Order.findByPk(orderId, {
      include: [
        { model: Profile, as: 'user', attributes: ['firstName', 'lastName', 'email'], required: false },
        { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'], required: false }
      ]
    });
    res.json({ success: true, data: updated, message: 'Order updated successfully' });
  } catch (err) {
    logger.error('Owner PATCH order', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to update order' });
  }
});

router.delete('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const ids = req.ownerRestaurantIds;
    const isAdmin = req.user.role === 'admin' && ids === null;
    if (!isAdmin && (ids === null || !ids || ids.length === 0)) {
      return res.status(403).json({ error: 'Forbidden', message: 'No restaurant access' });
    }
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found', message: 'Order does not exist' });
    }
    const d = order.toJSON();
    if (!isAdmin && !orderBelongsToOwner(d, ids)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this order' });
    }
    const hasMultipleRestaurants = d.restaurantGroups && Object.keys(d.restaurantGroups).length > 1;
    if (hasMultipleRestaurants) {
      await order.update({ status: 'cancelled' });
      return res.json({ success: true, message: 'Order cancelled successfully', data: { status: 'cancelled' } });
    }
    await order.update({ status: 'cancelled' });
    res.json({ success: true, message: 'Order cancelled successfully', data: { status: 'cancelled' } });
  } catch (err) {
    logger.error('Owner DELETE order', { err: err.message });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to cancel order' });
  }
});

module.exports = router;

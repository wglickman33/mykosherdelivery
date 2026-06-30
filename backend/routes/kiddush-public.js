const express = require('express');
const { KiddushPackage, KiddushMenuItem } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

const toMenuItemJson = (row) => {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    id: j.id,
    name: j.name,
    description: j.description ?? null,
    price: parseFloat(j.price),
    category: j.category,
    imageUrl: j.imageUrl ?? j.image_url ?? null,
    itemType: j.itemType ?? j.item_type ?? 'simple',
    options: j.options ?? null,
    labels: Array.isArray(j.labels) ? j.labels : [],
    featured: j.featured === true,
    displayOrder: j.displayOrder ?? j.display_order ?? 0
  };
};

const toPublicJson = (row) => {
  const j = row.toJSON ? row.toJSON() : row;
  const menuItems = Array.isArray(j.menuItems)
    ? j.menuItems.map(toMenuItemJson)
    : [];
  return {
    id: j.id,
    category: j.category,
    sizeTier: j.sizeTier ?? j.size_tier,
    name: j.name,
    price: parseFloat(j.price),
    shortDescription: j.shortDescription ?? j.short_description ?? null,
    imageUrl: j.imageUrl ?? j.image_url ?? null,
    displayOrder: j.displayOrder ?? j.display_order ?? 0,
    menuItems
  };
};

router.get('/', async (req, res) => {
  try {
    const rows = await KiddushPackage.findAll({
      where: { isActive: true },
      include: [{
        model: KiddushMenuItem,
        as: 'menuItems',
        where: { available: true },
        required: false
      }],
      order: [
        ['category', 'ASC'],
        ['displayOrder', 'ASC'],
        ['sizeTier', 'ASC'],
        [{ model: KiddushMenuItem, as: 'menuItems' }, 'displayOrder', 'ASC'],
        [{ model: KiddushMenuItem, as: 'menuItems' }, 'category', 'ASC'],
        [{ model: KiddushMenuItem, as: 'menuItems' }, 'name', 'ASC']
      ]
    });
    res.json({
      success: true,
      data: rows.map(toPublicJson)
    });
  } catch (err) {
    logger.error('Public kiddush packages list error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to load packages' });
  }
});

module.exports = router;

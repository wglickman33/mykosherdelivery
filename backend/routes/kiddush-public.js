const express = require('express');
const { KiddushPackage } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

const toPublicJson = (row) => {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    id: j.id,
    category: j.category,
    sizeTier: j.sizeTier ?? j.size_tier,
    name: j.name,
    price: parseFloat(j.price),
    shortDescription: j.shortDescription ?? j.short_description ?? null,
    includedItems: Array.isArray(j.includedItems) ? j.includedItems : (j.included_items || []),
    imageUrl: j.imageUrl ?? j.image_url ?? null,
    displayOrder: j.displayOrder ?? j.display_order ?? 0
  };
};

router.get('/', async (req, res) => {
  try {
    const rows = await KiddushPackage.findAll({
      where: { isActive: true },
      order: [
        ['category', 'ASC'],
        ['displayOrder', 'ASC'],
        ['sizeTier', 'ASC']
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

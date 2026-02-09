const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { GiftCard, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validate code and return balance (for checkout)
router.post('/validate', [
  body('code').notEmpty().trim().isLength({ max: 32 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid code', details: errors.array() });
    }
    const normalized = req.body.code.trim().replace(/\s/g, '').toUpperCase();
    const card = await GiftCard.findOne({
      where: {
        status: 'active',
        [Op.and]: [sequelize.where(sequelize.fn('UPPER', sequelize.col('code')), normalized)]
      }
    });
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or inactive gift card code',
        valid: false
      });
    }
    const balance = parseFloat(card.balance);
    if (balance <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Gift card has no remaining balance',
        valid: false,
        balance: 0
      });
    }
    return res.json({
      success: true,
      valid: true,
      balance: balance,
      giftCardId: card.id,
      code: card.code
    });
  } catch (err) {
    logger.error('Gift card validate error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to validate gift card' });
  }
});

// List my gift cards (purchased by me or that I can use - we show purchased)
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const cards = await GiftCard.findAll({
      where: { purchasedByUserId: req.userId },
      order: [['createdAt', 'DESC']]
    });
    const data = cards.map(c => ({
      id: c.id,
      code: c.code,
      initialBalance: parseFloat(c.initialBalance),
      balance: parseFloat(c.balance),
      status: c.status,
      createdAt: c.createdAt,
      orderId: c.orderId
    }));
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('Gift cards mine error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to load gift cards' });
  }
});

module.exports = router;

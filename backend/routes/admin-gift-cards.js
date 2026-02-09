const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { GiftCard, Profile, Order } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { createGiftCard } = require('../services/giftCardService');
const { createAdminNotification } = require('../utils/adminNotifications');

const router = express.Router();

// List all gift cards (admin)
router.get('/', requireAdmin, [
  query('status').optional().isIn(['active', 'used', 'void']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    const offset = (page - 1) * limit;
    const { count, rows } = await GiftCard.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Profile, as: 'purchasedBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Order, as: 'order', attributes: ['id', 'orderNumber'] }
      ]
    });
    const data = rows.map(c => ({
      id: c.id,
      code: c.code,
      initialBalance: parseFloat(c.initialBalance),
      balance: parseFloat(c.balance),
      status: c.status,
      purchasedByUserId: c.purchasedByUserId,
      purchasedBy: c.purchasedBy ? { id: c.purchasedBy.id, firstName: c.purchasedBy.firstName, lastName: c.purchasedBy.lastName, email: c.purchasedBy.email } : null,
      orderId: c.orderId,
      orderNumber: c.order ? c.order.orderNumber : null,
      recipientEmail: c.recipientEmail,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
    res.json({
      success: true,
      data,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
    });
  } catch (err) {
    logger.error('Admin gift cards list error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to list gift cards' });
  }
});

// Get one gift card
router.get('/:id', requireAdmin, [param('id').isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const card = await GiftCard.findByPk(req.params.id, {
      include: [
        { model: Profile, as: 'purchasedBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Order, as: 'order', attributes: ['id', 'orderNumber'] }
      ]
    });
    if (!card) return res.status(404).json({ success: false, error: 'Gift card not found' });
    res.json({
      success: true,
      data: {
        id: card.id,
        code: card.code,
        initialBalance: parseFloat(card.initialBalance),
        balance: parseFloat(card.balance),
        status: card.status,
        purchasedByUserId: card.purchasedByUserId,
        purchasedBy: card.purchasedBy ? { id: card.purchasedBy.id, firstName: card.purchasedBy.firstName, lastName: card.purchasedBy.lastName, email: card.purchasedBy.email } : null,
        orderId: card.orderId,
        orderNumber: card.order ? card.order.orderNumber : null,
        recipientEmail: card.recipientEmail,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt
      }
    });
  } catch (err) {
    logger.error('Admin gift card get error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to get gift card' });
  }
});

// Create gift card (manual, admin)
router.post('/', requireAdmin, [
  body('initialBalance').isFloat({ min: 0.01 }).toFloat(),
  body('recipientEmail').optional().isEmail().normalizeEmail(),
  body('purchasedByUserId').optional().isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { initialBalance, recipientEmail, purchasedByUserId } = req.body;
    const card = await createGiftCard({
      initialBalance,
      purchasedByUserId: purchasedByUserId || null,
      recipientEmail: recipientEmail || null
    });
    await createAdminNotification({
      type: 'gift_card.created',
      title: 'Gift card created',
      message: `Gift card ${card.code} ($${initialBalance}) created`,
      ref: { kind: 'gift_card', id: card.id, code: card.code }
    });
    res.status(201).json({
      success: true,
      data: {
        id: card.id,
        code: card.code,
        initialBalance: parseFloat(card.initialBalance),
        balance: parseFloat(card.balance),
        status: card.status,
        createdAt: card.createdAt
      }
    });
  } catch (err) {
    logger.error('Admin gift card create error', { err: err.message });
    res.status(500).json({ success: false, error: err.message || 'Failed to create gift card' });
  }
});

// Update gift card (e.g. void, or set balance)
router.patch('/:id', requireAdmin, [
  param('id').isUUID(),
  body('status').optional().isIn(['active', 'used', 'void']),
  body('balance').optional().isFloat({ min: 0 }).toFloat()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const card = await GiftCard.findByPk(req.params.id);
    if (!card) return res.status(404).json({ success: false, error: 'Gift card not found' });
    const updates = {};
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.balance !== undefined) updates.balance = Math.round(req.body.balance * 100) / 100;
    await card.update(updates);
    res.json({
      success: true,
      data: {
        id: card.id,
        code: card.code,
        initialBalance: parseFloat(card.initialBalance),
        balance: parseFloat(card.balance),
        status: card.status
      }
    });
  } catch (err) {
    logger.error('Admin gift card update error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to update gift card' });
  }
});

// Delete gift card (admin) - soft delete by voiding
router.delete('/:id', requireAdmin, [param('id').isUUID()], async (req, res) => {
  try {
    const card = await GiftCard.findByPk(req.params.id);
    if (!card) return res.status(404).json({ success: false, error: 'Gift card not found' });
    await card.update({ status: 'void' });
    res.json({ success: true, message: 'Gift card voided' });
  } catch (err) {
    logger.error('Admin gift card delete error', { err: err.message });
    res.status(500).json({ success: false, error: 'Failed to void gift card' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Promo code required',
        message: 'Please enter a promo code'
      });
    }

    const [results] = await sequelize.query(
      'SELECT * FROM promo_codes WHERE code = :code LIMIT 1',
      {
        replacements: { code: code },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!results) {
      return res.status(404).json({
        error: 'Invalid promo code',
        message: 'This promo code does not exist'
      });
    }

    const now = new Date();
    if (!results.active) {
      return res.status(400).json({
        error: 'Invalid promo code',
        message: 'This promo code has been deactivated'
      });
    }
    
    if (results.expires_at && now > new Date(results.expires_at)) {
      return res.status(400).json({
        error: 'Invalid promo code',
        message: 'This promo code has expired'
      });
    }
    
    if (results.usage_limit && results.usage_count >= results.usage_limit) {
      return res.status(400).json({
        error: 'Invalid promo code',
        message: 'This promo code has reached its usage limit'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        code: results.code,
        discountType: results.discount_type,
        discountValue: parseFloat(results.discount_value),
        expiresAt: results.expires_at
      },
      message: 'Promo code is valid'
    });

  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate promo code'
    });
  }
});

router.post('/calculate-discount', async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code || !subtotal) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Promo code and subtotal are required'
      });
    }

    const [results] = await sequelize.query(
      'SELECT * FROM promo_codes WHERE code = :code LIMIT 1',
      {
        replacements: { code: code },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!results) {
      return res.status(400).json({
        error: 'Invalid promo code',
        message: 'This promo code is not valid'
      });
    }

    const now = new Date();
    if (!results.active || 
        (results.expires_at && now > new Date(results.expires_at)) ||
        (results.usage_limit && results.usage_count >= results.usage_limit)) {
      return res.status(400).json({
        error: 'Invalid promo code',
        message: 'This promo code is not valid'
      });
    }

    let discountAmount = 0;
    const subtotalValue = parseFloat(subtotal);
    
    if (results.discount_type === 'percentage') {
      discountAmount = (subtotalValue * parseFloat(results.discount_value)) / 100;
    } else if (results.discount_type === 'fixed') {
      discountAmount = Math.min(parseFloat(results.discount_value), subtotalValue);
    }

    res.status(200).json({
      success: true,
      data: {
        code: results.code,
        discountType: results.discount_type,
        discountValue: parseFloat(results.discount_value),
        discountAmount: discountAmount,
        subtotal: subtotalValue,
        newSubtotal: subtotalValue - discountAmount
      },
      message: 'Discount calculated successfully'
    });

  } catch (error) {
    console.error('Error calculating discount:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate discount'
    });
  }
});

module.exports = router; 
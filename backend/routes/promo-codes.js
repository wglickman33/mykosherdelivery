const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { sequelize } = require('../models');

const PROMO_DAY_TIMEZONE = process.env.PROMO_TIMEZONE || process.env.COUNTDOWN_TIMEZONE || 'America/New_York';

/** Current day of week (0=Sun .. 6=Sat) in the business timezone, so "Monday only" means Monday in EST, not UTC. */
function getDayOfWeekInTimezone(timezone = PROMO_DAY_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  const short = formatter.format(new Date());
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? new Date().getDay();
}

const validateCodeBody = [
  body('code').notEmpty().withMessage('Promo code is required').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Code must be 1–50 characters')
];

router.post('/validate', validateCodeBody, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0]?.msg || 'Invalid input',
        details: errors.array()
      });
    }
    const { code } = req.body;

    const codeTrimmed = typeof code === 'string' ? code.trim() : String(code);

    const [results] = await sequelize.query(
      'SELECT * FROM promo_codes WHERE LOWER(TRIM(code)) = LOWER(:code) LIMIT 1',
      {
        replacements: { code: codeTrimmed },
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

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (results.allowed_days != null && String(results.allowed_days).trim() !== '') {
      const allowed = String(results.allowed_days).split(',').map(d => parseInt(d, 10)).filter(d => !Number.isNaN(d) && d >= 0 && d <= 6);
      if (allowed.length > 0) {
        const today = getDayOfWeekInTimezone();
        if (!allowed.includes(today)) {
          return res.status(400).json({
            error: 'Invalid promo code',
            message: `This promo code is only valid on ${allowed.map(d => dayNames[d]).join(', ')}. It cannot be used on ${dayNames[today]}.`
          });
        }
      }
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

const calculateDiscountBody = [
  body('code').notEmpty().withMessage('Promo code is required').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Code must be 1–50 characters'),
  body('subtotal').notEmpty().withMessage('Subtotal is required').isFloat({ min: 0 }).withMessage('Subtotal must be a non-negative number').toFloat()
];

router.post('/calculate-discount', calculateDiscountBody, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0]?.msg || 'Invalid input',
        details: errors.array()
      });
    }
    const { code, subtotal } = req.body;
    const codeTrimmed = typeof code === 'string' ? code.trim() : String(code);

    const [results] = await sequelize.query(
      'SELECT * FROM promo_codes WHERE LOWER(TRIM(code)) = LOWER(:code) LIMIT 1',
      {
        replacements: { code: codeTrimmed },
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

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (results.allowed_days != null && String(results.allowed_days).trim() !== '') {
      const allowed = String(results.allowed_days).split(',').map(d => parseInt(d, 10)).filter(d => !Number.isNaN(d) && d >= 0 && d <= 6);
      if (allowed.length > 0) {
        const today = getDayOfWeekInTimezone();
        if (!allowed.includes(today)) {
          return res.status(400).json({
            error: 'Invalid promo code',
            message: `This promo code is only valid on ${allowed.map(d => dayNames[d]).join(', ')}. It cannot be used on ${dayNames[today]}.`
          });
        }
      }
    }

    let discountAmount = 0;
    const subtotalValue = typeof subtotal === 'number' ? subtotal : parseFloat(subtotal);
    
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
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { Profile, UserLoginActivity, AdminNotification, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { appEvents } = require('../utils/events');

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d', algorithm: 'HS256' }
  );
};

const logLoginActivity = async (userId, req, success = true) => {
  try {
    await UserLoginActivity.create({
      userId: userId || null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success
    });
  } catch {
    void 0;
  }
};

async function createGlobalAdminNotification(payload) {
  try {
    const notif = await AdminNotification.create({
      type: payload.type,
      title: payload.title,
      message: payload.body || payload.message || '',
      readBy: [],
      data: payload.ref || null
    });
    
    try { 
      appEvents.emit('admin.notification.created', { 
        id: notif.id, 
        type: notif.type, 
        title: notif.title, 
        message: notif.message, 
        data: notif.data, 
        createdAt: notif.createdAt 
      }); 
    } catch (err) { 
      logger.warn('Emit admin notification error', err); 
    }
    
    return notif;
  } catch (err) { 
    logger.warn('Create global admin notification error', err); 
    return null;
  }
}

router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*\d)/)
    .withMessage('Password must contain at least one number')
    .matches(/^(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one special character'),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, firstName, lastName } = req.body;

    let existingUser;
    try {
      existingUser = await Profile.findOne({ where: { email } });
    } catch (dbError) {
      if (dbError.message?.includes('nursing_home_facility_id') || dbError.original?.message?.includes('nursing_home_facility_id')) {
        const { sequelize } = require('../models');
        const { QueryTypes } = require('sequelize');
        const rows = await sequelize.query(`
          SELECT id, email FROM profiles WHERE LOWER(email) = LOWER(:email)
        `, {
          replacements: { email },
          type: QueryTypes.SELECT
        });
        existingUser = rows && rows.length > 0 ? { id: rows[0].id, email: rows[0].email } : null;
      } else {
        throw dbError;
      }
    }
    
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    const user = await Profile.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'user'
    });

    const token = generateToken(user.id);

    await logLoginActivity(user.id, req);

    try {
      await createGlobalAdminNotification({
        type: 'user.created',
        title: 'New User Signed Up',
        message: `User "${firstName} ${lastName}" (${email}) has signed up`,
        ref: { kind: 'user', id: user.id, name: `${firstName} ${lastName}`, email }
      });
    } catch (notifError) {
      logger.warn('Failed to create user signup notification:', notifError);
    }

    const userData = user.toJSON();
    delete userData.password;

    res.status(201).json({
      data: {
        user: userData,
        session: {
          access_token: token,
          user: userData
        }
      },
      error: null
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create account'
    });
  }
});

router.post('/signin', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;
    
    logger.debug('Signin attempt', { 
      email: email.substring(0, 5) + '***',
      emailLength: email.length 
    });

    let user;
    try {
      user = await Profile.findOne({ 
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('email')), 
          sequelize.fn('LOWER', email)
        ),
        attributes: { include: ['password'] }
      });
    } catch (dbError) {
      if (dbError.message?.includes('nursing_home_facility_id') || dbError.original?.message?.includes('nursing_home_facility_id')) {
        const { sequelize } = require('../models');
        const { QueryTypes } = require('sequelize');
        const rows = await sequelize.query(`
          SELECT id, email, password, first_name AS "firstName", last_name AS "lastName", 
                 phone, preferred_name AS "preferredName", address, addresses, 
                 primary_address_index AS "primaryAddressIndex", role, 
                 created_at AS "createdAt", updated_at AS "updatedAt"
          FROM profiles 
          WHERE LOWER(email) = LOWER(:email)
        `, {
          replacements: { email },
          type: QueryTypes.SELECT
        });
        if (rows && rows.length > 0) {
          const userData = rows[0];
          user = Profile.build({
            id: userData.id,
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            preferredName: userData.preferredName,
            address: userData.address,
            addresses: userData.addresses,
            primaryAddressIndex: userData.primaryAddressIndex,
            role: userData.role,
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt
          }, { isNewRecord: false });
          
          if (user.setDataValue) {
            user.setDataValue('password', userData.password);
          } else {
            user.password = userData.password;
          }
        } else {
          user = null;
        }
      } else {
        throw dbError;
      }
    }
    
    if (!user) {
      logger.warn('Login failed: User not found', { email: email.substring(0, 5) + '***' });
      await logLoginActivity(null, req, false);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    let passwordHash = null;
    if (user.getDataValue) {
      passwordHash = user.getDataValue('password');
    }
    if (!passwordHash && user.dataValues && user.dataValues.password) {
      passwordHash = user.dataValues.password;
    }
    if (!passwordHash && user.get) {
      passwordHash = user.get('password');
    }
    if (!passwordHash && user.password) {
      passwordHash = user.password;
    }
    
    if (!passwordHash) {
      logger.error('Login failed: User has no password hash', { 
        userId: user.id, 
        email: email.substring(0, 5) + '***',
        hasGetDataValue: !!user.getDataValue,
        hasGet: !!user.get,
        hasPassword: !!user.password
      });
      await logLoginActivity(user.id, req, false);
      return res.status(500).json({
        error: 'Account error',
        message: 'Your account is missing password information. Please contact support.'
      });
    }
    
    logger.debug('Password comparison attempt', { userId: user.id });

    const isValidPassword = await bcrypt.compare(password, passwordHash);

    logger.debug('Password comparison result', { userId: user.id, isValid: isValidPassword });
    
    if (!isValidPassword) {
      logger.warn('Login failed: Invalid password', { 
        userId: user.id, 
        email: email.substring(0, 5) + '***'
      });
      await logLoginActivity(user.id, req, false);
      return res.status(401).json({
        error: 'Invalid credentials', 
        message: 'Email or password is incorrect'
      });
    }
    
    logger.debug('Password comparison successful', { userId: user.id });

    const token = generateToken(user.id);

    await logLoginActivity(user.id, req);

    const userData = user.toJSON();
    delete userData.password;

    res.json({
      data: {
        user: userData,
        session: {
          access_token: token,
          user: userData
        }
      },
      error: null
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to sign in'
    });
  }
});

router.get('/session', authenticateToken, async (req, res) => {
  try {
    const userData = req.user.toJSON();
    delete userData.password;
    
    res.json({
      data: {
        session: {
          access_token: req.headers.authorization.split(' ')[1],
          user: userData
        }
      },
      error: null
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get session'
    });
  }
});

router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const newToken = generateToken(req.userId);
    
    const userData = req.user.toJSON();
    delete userData.password;

    logger.info('Token refreshed successfully', { userId: req.userId });

    res.json({
      data: {
        session: {
          access_token: newToken,
          user: userData
        }
      },
      error: null
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh token'
    });
  }
});

router.post('/signout', authenticateToken, async (req, res) => {
  try {
    if (req.token) {
      const { blacklistToken } = require('../middleware/auth');
      blacklistToken(req.token);
    }
    
    res.json({
      error: null,
      message: 'Signed out successfully'
    });
  } catch (error) {
    logger.error('Signout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to sign out'
    });
  }
});

// POST /api/auth/forgot-password
// Generates a reset token, stores its hash, and returns token data for the frontend to send via EmailJS.
// Always responds with 200 to prevent email enumeration.
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return 200 even on bad input to prevent enumeration
      return res.status(200).json({ success: true });
    }

    const { email } = req.body;

    let user;
    try {
      user = await Profile.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('email')),
          sequelize.fn('LOWER', email)
        )
      });
    } catch (dbError) {
      if (dbError.message?.includes('nursing_home_facility_id') || dbError.original?.message?.includes('nursing_home_facility_id')) {
        const rows = await sequelize.query(
          `SELECT id, email, first_name AS "firstName", last_name AS "lastName" FROM profiles WHERE LOWER(email) = LOWER(:email)`,
          { replacements: { email }, type: QueryTypes.SELECT }
        );
        user = rows && rows.length > 0 ? rows[0] : null;
      } else {
        throw dbError;
      }
    }

    if (!user) {
      // Don't reveal whether the email exists
      return res.status(200).json({ success: true });
    }

    // Invalidate any existing unused tokens for this user
    await sequelize.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = :userId AND used_at IS NULL`,
      { replacements: { userId: user.id } }
    );

    // Generate a cryptographically secure random token
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sequelize.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (gen_random_uuid(), :userId, :tokenHash, :expiresAt, NOW())`,
      { replacements: { userId: user.id, tokenHash, expiresAt } }
    );

    logger.info('Password reset token generated', { userId: user.id });

    // Return token and user info for the frontend to send via EmailJS
    return res.status(200).json({
      success: true,
      token: plainToken,
      firstName: user.firstName || 'there',
      email: user.email
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
// Validates the token and updates the user's password.
router.post('/reset-password', [
  body('token').notEmpty().isLength({ min: 64, max: 64 }),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*\d)/)
    .withMessage('Password must contain at least one number')
    .matches(/^(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one special character')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { token, password } = req.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const results = await sequelize.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = :tokenHash AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      { replacements: { tokenHash }, type: QueryTypes.SELECT }
    );

    const resetToken = results[0];

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'This password reset link is invalid or has expired. Please request a new one.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    await Profile.update(
      { password: hashedPassword },
      { where: { id: resetToken.user_id } }
    );

    // Mark token as used
    await sequelize.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = :tokenHash`,
      { replacements: { tokenHash } }
    );

    logger.info('Password reset successful', { userId: resetToken.user_id });

    res.status(200).json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to reset password' });
  }
});

module.exports = router;
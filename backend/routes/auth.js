const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Profile, UserLoginActivity, AdminNotification } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { appEvents } = require('../utils/events');

const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper function to log login activity
const logLoginActivity = async (userId, req, success = true) => {
  try {
    await UserLoginActivity.create({
      userId: userId || null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success
    });
  } catch {
    // Non-blocking
  }
};

// Helper function to create global admin notifications
async function createGlobalAdminNotification(payload) {
  try {
    const notif = await AdminNotification.create({
      type: payload.type,
      title: payload.title,
      message: payload.body || payload.message || '',
      readBy: [], // Empty array means no admin has read it yet
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

// Sign Up Route
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

    // Check if user already exists
    const existingUser = await Profile.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    // Create user profile
    const user = await Profile.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'user'
    });

    // Generate JWT token
    const token = generateToken(user.id);

    // Log login activity
    await logLoginActivity(user.id, req);

    // Create notification for user signup
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

    // Return user data (excluding password)
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

// Sign In Route
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

    // Find user by email
    const user = await Profile.findOne({ where: { email } });
    if (!user) {
      await logLoginActivity(null, req, false);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await logLoginActivity(user.id, req, false);
      return res.status(401).json({
        error: 'Invalid credentials', 
        message: 'Email or password is incorrect'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Log successful login
    await logLoginActivity(user.id, req);

    // Return user data (excluding password)
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

// Get Session Route (verify current token)
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

// Refresh Token Route
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate a new token for the authenticated user
    const newToken = generateToken(req.userId);
    
    // Get fresh user data
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

// Sign Out Route (client-side token removal, but we log it)
router.post('/signout', authenticateToken, async (req, res) => {
  try {
    // Add token to blacklist to prevent reuse
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

module.exports = router; 
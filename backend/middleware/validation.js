const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errors.array(),
      ip: req.ip
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input and try again',
      details: errors.array()
    });
  }
  next();
};

const validationRules = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  firstName: body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  lastName: body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  phone: body('phone')
    .optional()
    .isMobilePhone('en-US')
    .withMessage('Please provide a valid US phone number'),

  uuid: (field) => param(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`),

  page: query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a number between 1 and 1000'),

  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a number between 1 and 100'),

  address: body('address')
    .isObject()
    .withMessage('Address must be an object'),

  addressLine1: body('address.line1')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Address line 1 is required and must be less than 100 characters'),

  city: body('address.city')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('City is required and must be less than 50 characters'),

  state: body('address.state')
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('State must be a 2-letter state code'),

  zipCode: body('address.zipCode')
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Zip code must be in format 12345 or 12345-6789'),

  orderItems: body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  orderAmount: body('amount')
    .isFloat({ min: 0.01, max: 9999.99 })
    .withMessage('Amount must be between $0.01 and $9,999.99'),

  restaurantId: body('restaurantId')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Restaurant ID is required'),

  menuItemName: body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Menu item name must be between 1 and 100 characters'),

  menuItemPrice: body('price')
    .isFloat({ min: 0.01, max: 999.99 })
    .withMessage('Price must be between $0.01 and $999.99'),

  searchQuery: query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-'".]+$/)
    .withMessage('Search query contains invalid characters'),

  dateFrom: query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO 8601 date'),

  dateTo: query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO 8601 date'),

  imageFile: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'File required',
        message: 'Please upload an image file'
      });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // =5MB

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only JPEG, PNG, and WebP images are allowed'
      });
    }

    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        message: 'Image must be less than 5MB'
      });
    }

    next();
  }
};

const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => {
        if (typeof item === 'string') {
          return sanitizeString(item);
        } else if (typeof item === 'object') {
          return sanitizeObject(item);
        } else {
          return item;
        }
      });
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

const validateRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    const exemptPaths = [
      '/api/health', 
      '/api/auth/session', 
      '/api/auth/refresh',
      '/api/orders',
      '/api/payments/create-intent',
      '/api/payments/webhook'
    ];
    const isExempt = exemptPaths.some(path => req.path === path || req.path.endsWith(path));
    if (isExempt) {
      return next();
    }

    const userRequests = requests.get(key) || [];
    const validRequests = userRequests.filter(time => time > windowStart);

    if (validRequests.length >= max) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        requestCount: validRequests.length
      });

      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please slow down and try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    validRequests.push(now);
    requests.set(key, validRequests);

    next();
  };
};

module.exports = {
  handleValidationErrors,
  validationRules,
  sanitizeInput,
  validateRateLimit
};
require('dotenv').config();

const logger = require('../utils/logger');

// Security config constants
const SECURITY_CONFIG = {
  // JWT Config
  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    ALGORITHM: 'HS256',
    ISSUER: 'mykosherdelivery',
    AUDIENCE: 'mkd-users'
  },

  // Password Security
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true
  },

  // Rate Limits
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // =15 minutes
    MAX_REQUESTS: process.env.NODE_ENV === 'production' ? 100 : 1000,
    AUTH_WINDOW_MS: 15 * 60 * 1000, // =15 minutes
    AUTH_MAX_ATTEMPTS: process.env.NODE_ENV === 'production' ? 5 : 50,
    PAYMENT_WINDOW_MS: 60 * 1000, // =1 minute
    PAYMENT_MAX_REQUESTS: process.env.NODE_ENV === 'production' ? 10 : 100
  },

  // Session Security
  SESSION: {
    MAX_AGE: 7 * 24 * 60 * 60 * 1000, // =7 days
    SECURE: process.env.NODE_ENV === 'production',
    HTTP_ONLY: true,
    SAME_SITE: 'strict'
  },

  // CORS Config
  CORS: {
    ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    CREDENTIALS: true,
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Request-ID']
  },

  // File Upload Security
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // =5MB
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
    UPLOAD_PATH: './uploads/',
    TEMP_PATH: './uploads/temp/'
  },

  // Input Validation
  VALIDATION: {
    MAX_STRING_LENGTH: 1000,
    MAX_ARRAY_LENGTH: 100,
    MAX_OBJECT_DEPTH: 5,
    SANITIZE_HTML: true,
    STRIP_TAGS: true
  },

  // Database Security
  DATABASE: {
    CONNECTION_TIMEOUT: 60000,
    QUERY_TIMEOUT: 30000,
    MAX_CONNECTIONS: process.env.NODE_ENV === 'production' ? 20 : 10,
    MIN_CONNECTIONS: process.env.NODE_ENV === 'production' ? 5 : 2
  },

  // API Security
  API: {
    MAX_REQUEST_SIZE: '10mb',
    TIMEOUT: 30000,
    ENABLE_ETAG: false,
    TRUST_PROXY: process.env.NODE_ENV === 'production'
  },

  // Logging Security
  LOGGING: {
    MASK_SENSITIVE_DATA: true,
    SENSITIVE_FIELDS: [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session',
      'credit_card',
      'ssn',
      'social_security'
    ],
    MAX_LOG_SIZE: '100mb',
    MAX_LOG_FILES: 10
  }
};

// Validate critical security configurations
const validateSecurityConfig = () => {
  const errors = [];

  // Validate JWT secret
  if (!SECURITY_CONFIG.JWT.SECRET || SECURITY_CONFIG.JWT.SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  // Validate bcrypt salt rounds
  if (SECURITY_CONFIG.PASSWORD.SALT_ROUNDS < 10) {
    errors.push('BCRYPT_SALT_ROUNDS should be at least 10 for security');
  }

  // Validate CORS origin in production
  if (process.env.NODE_ENV === 'production' && 
      SECURITY_CONFIG.CORS.ORIGIN === 'http://localhost:5173') { // Needs to be changed in production
    errors.push('CORS_ORIGIN must be set to production domain');
  }

  if (errors.length > 0) {
    logger.error('Security configuration validation failed:', errors);
    throw new Error(`Security configuration errors: ${errors.join(', ')}`);
  }

  logger.info('Security configuration validated successfully');
};

// Content Security Policy
const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  scriptSrc: ["'self'"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'", "https://api.stripe.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  childSrc: ["'none'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
};

// Security Headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': process.env.NODE_ENV === 'production' 
    ? 'max-age=31536000; includeSubDomains; preload' 
    : undefined
};

// Helmet configuration
const HELMET_CONFIG = {
  contentSecurityPolicy: {
    directives: CSP_DIRECTIVES,
    reportOnly: process.env.NODE_ENV === 'development'
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'cross-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
};

// Initialize security config
const initializeSecurity = () => {
  try {
    validateSecurityConfig();
    logger.info('Security configuration initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize security configuration:', error);
    return false;
  }
};

module.exports = {
  SECURITY_CONFIG,
  CSP_DIRECTIVES,
  SECURITY_HEADERS,
  HELMET_CONFIG,
  validateSecurityConfig,
  initializeSecurity
};
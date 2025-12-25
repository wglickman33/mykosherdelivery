const jwt = require('jsonwebtoken');
const { Profile } = require('../models');
const logger = require('../utils/logger');

const blacklistedTokens = new Set();

const authAttempts = new Map();
const MAX_AUTH_ATTEMPTS = process.env.NODE_ENV === 'production' ? 20 : 200;
const AUTH_LOCKOUT_TIME = process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 1 * 60 * 1000;

const checkRateLimit = (ip) => {
  const attempts = authAttempts.get(ip);
  if (!attempts) return true;
  
  if (attempts.count >= MAX_AUTH_ATTEMPTS) {
    const timeLeft = AUTH_LOCKOUT_TIME - (Date.now() - attempts.firstAttempt);
    if (timeLeft > 0) {
      return false;
    } else {
      authAttempts.delete(ip);
      return true;
    }
  }
  return true;
};

const recordFailedAttempt = (ip) => {
  const attempts = authAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  attempts.count++;
  if (attempts.count === 1) {
    attempts.firstAttempt = Date.now();
  }
  authAttempts.set(ip, attempts);
};

const clearFailedAttempts = (ip) => {
  authAttempts.delete(ip);
};

const blacklistToken = (token) => {
  blacklistedTokens.add(token);
  logger.info('Token blacklisted');
};

const authenticateToken = async (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const isSessionCheck = req.path === '/session' || req.path === '/refresh' || req.path.includes('/session');

    if (!isSessionCheck && !checkRateLimit(clientIp)) {
      logger.warn('Authentication rate limit exceeded', { ip: clientIp });
      return res.status(429).json({ 
        error: 'Too many authentication attempts',
        message: 'Please try again later'
      });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    if (blacklistedTokens.has(token)) {
      recordFailedAttempt(clientIp);
      logger.warn('Blacklisted token used', { ip: clientIp });
      return res.status(401).json({ 
        error: 'Token revoked',
        message: 'This token has been revoked. Please sign in again.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    logger.debug('Token verified successfully', {
      userId: decoded.userId,
      issuedAt: new Date(decoded.iat * 1000).toISOString(),
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
      tokenAge: Math.floor((Date.now() / 1000 - decoded.iat) / 3600) + ' hours'
    });
    
    const user = await Profile.findByPk(decoded.userId);
    if (!user) {
      recordFailedAttempt(clientIp);
      logger.warn('Token for non-existent user', { userId: decoded.userId, ip: clientIp });
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    clearFailedAttempts(clientIp);

    req.user = user;
    req.userId = user.id;
    req.token = token;

    logger.debug('User authenticated successfully', { 
      userId: user.id, 
      ip: clientIp,
      userAgent: req.get('User-Agent')
    });
    
    next();
  } catch (error) {
    recordFailedAttempt(clientIp);
    
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', { ip: clientIp, error: error.message });
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token is malformed or invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired JWT token', { ip: clientIp });
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please sign in again'
      });
    }

    logger.error('Auth middleware error:', error, { ip: clientIp });
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    await new Promise((resolve, reject) => {
      authenticateToken(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch {
    return;
  }

  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please sign in first'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'You do not have permission to access this resource'
    });
  }

  next();
};

const requireRestaurantOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please sign in first'
    });
  }

  if (req.user.role !== 'restaurant_owner' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Restaurant owner or admin access required',
      message: 'You do not have permission to access this resource'
    });
  }

  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await Profile.findByPk(decoded.userId);
      
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }
    
    next();
  } catch {
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireRestaurantOwnerOrAdmin,
  optionalAuth,
  blacklistToken,
  checkRateLimit
}; 
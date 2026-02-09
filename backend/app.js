const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET is required and must be at least 32 characters. Set it in backend/.env');
  process.exit(1);
}
const { sequelize } = require('./models');
const { sanitizeInput, validateRateLimit } = require('./middleware/validation');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const favoriteRoutes = require('./routes/favorites');
const adminRoutes = require('./routes/admin');
const promoCodeRoutes = require('./routes/promo-codes');
const supportRoutes = require('./routes/support');
const countdownRoutes = require('./routes/countdown');
const taxRoutes = require('./routes/tax');
const nursingHomeRoutes = require('./routes/nursing-homes');
const mapsRoutes = require('./routes/maps');
const adminMapsRoutes = require('./routes/admin-maps');
const adminGiftCardsRoutes = require('./routes/admin-gift-cards');
const adminOrdersStreamHandler = require('./routes/admin-orders-stream');
const giftCardsRoutes = require('./routes/gift-cards');
const { requireAdmin } = require('./middleware/auth');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
  'https://mykosherdelivery.com',
  'https://www.mykosherdelivery.com',
  'https://mykosherdelivery.netlify.app',
  'https://mykosherdelivery-659274a65452.herokuapp.com'
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

app.use(validateRateLimit(15 * 60 * 1000, 500));

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook' || req.path === '/api/payments/webhook' || req.url === '/api/payments/webhook') {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook' || req.path === '/api/payments/webhook' || req.url === '/api/payments/webhook') {
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

app.use(sanitizeInput);

app.use('/static', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('public'));

app.use((req, res, next) => {
  const { maskSensitiveData } = require('./utils/maskSensitiveData');
  const logData = {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
  
  if (req.method !== 'GET' && req.body) {
    logData.body = maskSensitiveData(req.body);
  }
  
  logger.info(`${req.method} ${req.path}`, logData);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/admin/maps', requireAdmin, adminMapsRoutes);
app.use('/api/admin/gift-cards', requireAdmin, adminGiftCardsRoutes);
app.get('/api/admin/orders/stream', adminOrdersStreamHandler);
app.use('/api/admin', adminRoutes);
app.use('/api/gift-cards', giftCardsRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/countdown', countdownRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/images', require('./routes/images'));
app.use('/api/nursing-homes', nursingHomeRoutes);
app.use('/api/maps', mapsRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await sequelize.authenticate()
      .then(() => 'connected')
      .catch(() => 'disconnected');
    
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbStatus
    });
  } catch {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'checking'
    });
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const name = err.name || 'Error';
  const safeMessage = err.message || 'Unknown error';
  console.error('[GLOBAL ERROR HANDLER]', name, safeMessage);
  console.error('[GLOBAL ERROR HANDLER] Stack:', err.stack || '(no stack)');
  logger.error('Unhandled error:', { message: safeMessage, status, name, path: req.path });
  const body = {
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : safeMessage,
    message: process.env.NODE_ENV === 'production' ? `Internal server error (${name})` : safeMessage,
    serverErrorName: name,
  };
  if (err.stack) body.serverStack = err.stack.split('\n').slice(0, 12).join('\n');
  res.status(status).json(body);
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

module.exports = app; 
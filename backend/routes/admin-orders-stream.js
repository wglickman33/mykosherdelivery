const jwt = require('jsonwebtoken');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const logger = require('../utils/logger');
const { appEvents } = require('../utils/events');

/**
 * GET /api/admin/orders/stream — SSE endpoint.
 * Auth via query ?token= (JWT from POST /api/admin/orders/stream-token).
 * Mounted at app level so it is never matched by GET /api/admin/orders/:orderId.
 */
function handleOrdersStream(req, res) {
  const token = req.query.token;
  logger.info('SSE stream: handler hit', { hasToken: !!token, path: req.path });

  (async () => {
    try {
      if (!token) {
        logger.warn('SSE stream: No token provided');
        return res.status(401).json({ error: 'No token provided' });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          logger.warn('SSE stream: Token expired', { expiredAt: jwtError.expiredAt });
          return res.status(401).json({ error: 'Token expired', expiredAt: jwtError.expiredAt });
        } else if (jwtError.name === 'JsonWebTokenError') {
          logger.warn('SSE stream: Invalid token', { error: jwtError.message });
          return res.status(401).json({ error: 'Invalid token', message: jwtError.message });
        } else {
          logger.error('SSE stream: JWT verification error', jwtError);
          return res.status(401).json({ error: 'Token verification failed', message: jwtError.message });
        }
      }

      if (!decoded || decoded.scope !== 'orders_stream') {
        logger.warn('SSE stream: Invalid scope', { scope: decoded?.scope, userId: decoded?.userId });
        return res.status(403).json({ error: 'Invalid token scope' });
      }

      if (!decoded.userId) {
        logger.warn('SSE stream: No userId in token');
        return res.status(401).json({ error: 'Invalid token: missing userId' });
      }

      // Raw query only — avoids Profile model/schema (e.g. missing nursing_home_facility_id in prod)
      const rows = await sequelize.query(
        `SELECT id, role FROM profiles WHERE id = :userId`,
        { replacements: { userId: decoded.userId }, type: QueryTypes.SELECT }
      );
      const user = rows?.[0];
      if (!user) {
        logger.warn('SSE stream: User not found', { userId: decoded.userId });
        return res.status(403).json({ error: 'User not found' });
      }
      if (user.role !== 'admin') {
        logger.warn('SSE stream: User is not admin', { userId: decoded.userId, role: user.role });
        return res.status(403).json({ error: 'Unauthorized: Admin access required' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const sendEvent = (type, payload) => {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      const heartbeat = setInterval(() => sendEvent('ping', { ts: Date.now() }), 25000);
      sendEvent('connected', { ts: Date.now() });

      const onCreated = (order) => sendEvent('order.created', order);
      const onUpdated = (order) => sendEvent('order.updated', order);
      const onNotification = (payload) => sendEvent('admin.notification.created', payload);

      appEvents.on('order.created', onCreated);
      appEvents.on('order.updated', onUpdated);
      appEvents.on('admin.notification.created', onNotification);

      req.on('close', () => {
        clearInterval(heartbeat);
        appEvents.off('order.created', onCreated);
        appEvents.off('order.updated', onUpdated);
        appEvents.off('admin.notification.created', onNotification);
        res.end();
      });
    } catch (error) {
      logger.error('SSE stream: Unexpected authentication error', error);
      if (!res.headersSent) {
        res.status(401).json({ error: 'Authentication failed', message: error.message });
      }
    }
  })();
}

module.exports = handleOrdersStream;

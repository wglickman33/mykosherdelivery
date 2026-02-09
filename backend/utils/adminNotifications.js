const { AdminNotification } = require('../models');
const { appEvents } = require('./events');
const logger = require('./logger');

/**
 * Create an admin notification and emit for real-time updates.
 * @param {{ type: string, title: string, message?: string, ref?: object }} payload
 */
async function createAdminNotification(payload) {
  try {
    const notif = await AdminNotification.create({
      type: payload.type,
      title: payload.title,
      message: payload.message || payload.body || '',
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
    logger.warn('Create admin notification error', err);
    return null;
  }
}

module.exports = { createAdminNotification };

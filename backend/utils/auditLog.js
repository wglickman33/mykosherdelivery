const { AdminAuditLog } = require('../models');
const logger = require('./logger');

/**
 * Log an admin action to the audit log (used by admin, admin-maps, nursing-home routes).
 * @param {string} adminId - User ID of the admin who performed the action
 * @param {string} action - CREATE | UPDATE | DELETE
 * @param {string} tableName - Logical table name (e.g. 'maps_restaurants', 'nh_resident_orders')
 * @param {string} recordId - ID of the affected record
 * @param {object|null} oldValues - Previous state (for UPDATE/DELETE)
 * @param {object|null} newValues - New state (for CREATE/UPDATE)
 * @param {object|null} req - Express request (for IP and User-Agent)
 */
async function logAdminAction(adminId, action, tableName, recordId, oldValues, newValues, req = null) {
  try {
    const ipAddress = req && (req.ip || req.connection?.remoteAddress) ? (req.ip || req.connection.remoteAddress) : null;
    const userAgent = req && typeof req.get === 'function' ? req.get('User-Agent') : null;

    await AdminAuditLog.create({
      adminId,
      action,
      tableName,
      recordId: recordId != null ? String(recordId) : null,
      oldValues: oldValues != null ? JSON.stringify(oldValues) : null,
      newValues: newValues != null ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    });

    logger.info('Admin action logged', { adminId, action, tableName, recordId });
  } catch (error) {
    logger.error('Error logging admin action:', error);
    throw error;
  }
}

module.exports = { logAdminAction };

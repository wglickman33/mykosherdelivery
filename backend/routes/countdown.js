const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { AdminAuditLog } = require('../models');

// Helper function to log admin actions
const logAdminAction = async (adminId, action, tableName, recordId, oldValues, newValues, req = null) => {
  try {
    const ipAddress = req ? req.ip || req.connection.remoteAddress : null;
    const userAgent = req ? req.get('User-Agent') : null;
    
    await AdminAuditLog.create({
      adminId,
      action,
      tableName,
      recordId,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    });
  } catch (error) {
    logger.error('Error logging admin action:', error);
  }
};

const router = express.Router();

// Get current countdown settings
router.get('/settings', async (req, res) => {
  try {
    // Default settings (matches current hardcoded logic)
    const defaultSettings = {
      targetDay: 4, // Thursday (0=Sunday, 4=Thursday)
      targetTime: '18:00', // 6:00 PM
      resetDay: 6, // Saturday (6=Saturday)
      resetTime: '00:00', // 12:00 AM
      timezone: 'America/New_York', // EST/EDT
    };

    // Get settings from environment variables or use defaults
    const settings = {
      targetDay: parseInt(process.env.COUNTDOWN_TARGET_DAY) || defaultSettings.targetDay,
      targetTime: process.env.COUNTDOWN_TARGET_TIME || defaultSettings.targetTime,
      resetDay: parseInt(process.env.COUNTDOWN_RESET_DAY) || defaultSettings.resetDay,
      resetTime: process.env.COUNTDOWN_RESET_TIME || defaultSettings.resetTime,
      timezone: process.env.COUNTDOWN_TIMEZONE || defaultSettings.timezone,
    };

    // Convert day numbers to readable names for frontend
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const response = {
      ...settings,
      targetDayName: dayNames[settings.targetDay],
      resetDayName: dayNames[settings.resetDay],
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching countdown settings:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch countdown settings'
    });
  }
});

// Update countdown settings (admin only)
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const { targetDay, targetTime, resetDay, resetTime, timezone } = req.body;

    // Validation
    if (targetDay !== undefined && (targetDay < 0 || targetDay > 6)) {
      return res.status(400).json({
        error: 'Invalid target day. Must be 0-6 (Sunday-Saturday)'
      });
    }

    if (resetDay !== undefined && (resetDay < 0 || resetDay > 6)) {
      return res.status(400).json({
        error: 'Invalid reset day. Must be 0-6 (Sunday-Saturday)'
      });
    }

    if (targetTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(targetTime)) {
      return res.status(400).json({
        error: 'Invalid target time format. Use HH:MM format (e.g., 18:00)'
      });
    }

    if (resetTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(resetTime)) {
      return res.status(400).json({
        error: 'Invalid reset time format. Use HH:MM format (e.g., 00:00)'
      });
    }

    // Get old settings for audit log BEFORE updating
    const oldSettings = {
      targetDay: parseInt(process.env.COUNTDOWN_TARGET_DAY) || 4,
      targetTime: process.env.COUNTDOWN_TARGET_TIME || '18:00',
      resetDay: parseInt(process.env.COUNTDOWN_RESET_DAY) || 6,
      resetTime: process.env.COUNTDOWN_RESET_TIME || '00:00',
      timezone: process.env.COUNTDOWN_TIMEZONE || 'America/New_York'
    };

    // Update environment variables
    if (targetDay !== undefined) process.env.COUNTDOWN_TARGET_DAY = targetDay.toString();
    if (targetTime !== undefined) process.env.COUNTDOWN_TARGET_TIME = targetTime;
    if (resetDay !== undefined) process.env.COUNTDOWN_RESET_DAY = resetDay.toString();
    if (resetTime !== undefined) process.env.COUNTDOWN_RESET_TIME = resetTime;
    if (timezone !== undefined) process.env.COUNTDOWN_TIMEZONE = timezone;

    const newSettings = {
      targetDay: parseInt(process.env.COUNTDOWN_TARGET_DAY) || 4,
      targetTime: process.env.COUNTDOWN_TARGET_TIME || '18:00',
      resetDay: parseInt(process.env.COUNTDOWN_RESET_DAY) || 6,
      resetTime: process.env.COUNTDOWN_RESET_TIME || '00:00',
      timezone: process.env.COUNTDOWN_TIMEZONE || 'America/New_York'
    };

    // Log admin action
    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'system_settings',
        'countdown_timer',
        oldSettings,
        newSettings,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for countdown settings update:', auditError);
    }

    // Log the update
    logger.info('Countdown settings updated by admin', {
      adminId: req.user.id,
      settings: newSettings
    });

    // Return updated settings
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const updatedSettings = {
      targetDay: parseInt(process.env.COUNTDOWN_TARGET_DAY),
      targetTime: process.env.COUNTDOWN_TARGET_TIME,
      resetDay: parseInt(process.env.COUNTDOWN_RESET_DAY),
      resetTime: process.env.COUNTDOWN_RESET_TIME,
      timezone: process.env.COUNTDOWN_TIMEZONE,
      targetDayName: dayNames[parseInt(process.env.COUNTDOWN_TARGET_DAY)],
      resetDayName: dayNames[parseInt(process.env.COUNTDOWN_RESET_DAY)],
    };

    res.json({
      message: 'Countdown settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    logger.error('Error updating countdown settings:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update countdown settings'
    });
  }
});

// Reset countdown settings to defaults (admin only)
router.post('/settings/reset', requireAdmin, async (req, res) => {
  try {
    // Get old settings for audit log
    const oldSettings = {
      targetDay: parseInt(process.env.COUNTDOWN_TARGET_DAY) || 4,
      targetTime: process.env.COUNTDOWN_TARGET_TIME || '18:00',
      resetDay: parseInt(process.env.COUNTDOWN_RESET_DAY) || 6,
      resetTime: process.env.COUNTDOWN_RESET_TIME || '00:00',
      timezone: process.env.COUNTDOWN_TIMEZONE || 'America/New_York'
    };

    // Reset to default values
    delete process.env.COUNTDOWN_TARGET_DAY;
    delete process.env.COUNTDOWN_TARGET_TIME;
    delete process.env.COUNTDOWN_RESET_DAY;
    delete process.env.COUNTDOWN_RESET_TIME;
    delete process.env.COUNTDOWN_TIMEZONE;

    const defaultSettings = {
      targetDay: 4,
      targetTime: '18:00',
      resetDay: 6,
      resetTime: '00:00',
      timezone: 'America/New_York'
    };

    // Log admin action
    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'system_settings',
        'countdown_timer',
        oldSettings,
        defaultSettings,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for countdown settings reset:', auditError);
    }

    logger.info('Countdown settings reset to defaults by admin', {
      adminId: req.user.id
    });

    res.json({
      message: 'Countdown settings reset to defaults successfully'
    });
  } catch (error) {
    logger.error('Error resetting countdown settings:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reset countdown settings'
    });
  }
});

module.exports = router;

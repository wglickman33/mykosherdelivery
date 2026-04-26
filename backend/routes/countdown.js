const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { logAdminAction } = require('../utils/auditLog');
const { SystemSetting } = require('../models');

const router = express.Router();

const DEFAULTS = {
  targetDay: 4,
  targetTime: '18:00',
  resetDay: 6,
  resetTime: '00:00',
  timezone: 'America/New_York',
};

const KEYS = ['COUNTDOWN_TARGET_DAY', 'COUNTDOWN_TARGET_TIME', 'COUNTDOWN_RESET_DAY', 'COUNTDOWN_RESET_TIME', 'COUNTDOWN_TIMEZONE'];

/**
 * Read a single countdown value: DB first, then process.env, then default.
 * Using ?? (nullish) instead of || so that day 0 (Sunday) is never replaced by the default.
 */
const readSetting = (dbMap, envKey, defaultValue) => {
  const dbVal = dbMap[envKey];
  if (dbVal !== null && dbVal !== undefined) return dbVal;
  const envVal = process.env[envKey];
  if (envVal !== null && envVal !== undefined && envVal !== '') return envVal;
  return defaultValue;
};

const parseDay = (raw) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
};

/**
 * Load all countdown settings, merging DB, env, and defaults (DB wins).
 * Returns the canonical settings object.
 */
const loadSettings = async () => {
  let dbMap = {};
  try {
    const rows = await SystemSetting.findAll({ where: { settingKey: KEYS } });
    for (const row of rows) {
      dbMap[row.settingKey] = row.settingValue;
    }
  } catch (err) {
    logger.warn('Could not read countdown settings from DB, falling back to env/defaults:', err.message);
  }

  const targetDayRaw = readSetting(dbMap, 'COUNTDOWN_TARGET_DAY', String(DEFAULTS.targetDay));
  const resetDayRaw  = readSetting(dbMap, 'COUNTDOWN_RESET_DAY',  String(DEFAULTS.resetDay));
  const targetDayParsed = parseDay(targetDayRaw);
  const resetDayParsed  = parseDay(resetDayRaw);

  return {
    targetDay:  targetDayParsed  !== null ? targetDayParsed  : DEFAULTS.targetDay,
    targetTime: readSetting(dbMap, 'COUNTDOWN_TARGET_TIME', DEFAULTS.targetTime),
    resetDay:   resetDayParsed   !== null ? resetDayParsed   : DEFAULTS.resetDay,
    resetTime:  readSetting(dbMap, 'COUNTDOWN_RESET_TIME',  DEFAULTS.resetTime),
    timezone:   readSetting(dbMap, 'COUNTDOWN_TIMEZONE',    DEFAULTS.timezone),
  };
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toResponse = (settings) => ({
  ...settings,
  targetDayName: DAY_NAMES[settings.targetDay],
  resetDayName:  DAY_NAMES[settings.resetDay],
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await loadSettings();
    res.json(toResponse(settings));
  } catch (error) {
    logger.error('Error fetching countdown settings:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch countdown settings' });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const { targetDay, targetTime, resetDay, resetTime, timezone } = req.body;

    if (targetDay !== undefined && (targetDay < 0 || targetDay > 6)) {
      return res.status(400).json({ error: 'Invalid target day. Must be 0-6 (Sunday-Saturday)' });
    }
    if (resetDay !== undefined && (resetDay < 0 || resetDay > 6)) {
      return res.status(400).json({ error: 'Invalid reset day. Must be 0-6 (Sunday-Saturday)' });
    }
    if (targetTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(targetTime)) {
      return res.status(400).json({ error: 'Invalid target time format. Use HH:MM (e.g., 18:00)' });
    }
    if (resetTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(resetTime)) {
      return res.status(400).json({ error: 'Invalid reset time format. Use HH:MM (e.g., 00:00)' });
    }

    const oldSettings = await loadSettings();

    const updates = [];
    if (targetDay !== undefined) updates.push({ key: 'COUNTDOWN_TARGET_DAY', value: String(targetDay) });
    if (targetTime !== undefined) updates.push({ key: 'COUNTDOWN_TARGET_TIME', value: targetTime });
    if (resetDay !== undefined) updates.push({ key: 'COUNTDOWN_RESET_DAY', value: String(resetDay) });
    if (resetTime !== undefined) updates.push({ key: 'COUNTDOWN_RESET_TIME', value: resetTime });
    if (timezone !== undefined) updates.push({ key: 'COUNTDOWN_TIMEZONE', value: timezone });

    for (const { key, value } of updates) {
      await SystemSetting.upsert({
        settingKey: key,
        settingValue: value,
        settingType: 'string',
        description: `Countdown timer setting: ${key}`
      });
      // Also mirror to process.env so any code still reading env works during the same process lifetime
      process.env[key] = value;
    }

    const newSettings = await loadSettings();

    try {
      await logAdminAction(req.user.id, 'UPDATE', 'system_settings', 'countdown_timer', oldSettings, newSettings, req);
    } catch (auditError) {
      logger.warn('Failed to log admin action for countdown settings update:', auditError);
    }

    logger.info('Countdown settings updated by admin', { adminId: req.user.id, settings: newSettings });

    res.json({ message: 'Countdown settings updated successfully', settings: toResponse(newSettings) });
  } catch (error) {
    logger.error('Error updating countdown settings:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to update countdown settings' });
  }
});

router.post('/settings/reset', requireAdmin, async (req, res) => {
  try {
    const oldSettings = await loadSettings();

    for (const key of KEYS) {
      await SystemSetting.destroy({ where: { settingKey: key } });
      delete process.env[key];
    }

    try {
      await logAdminAction(req.user.id, 'UPDATE', 'system_settings', 'countdown_timer', oldSettings, DEFAULTS, req);
    } catch (auditError) {
      logger.warn('Failed to log admin action for countdown settings reset:', auditError);
    }

    logger.info('Countdown settings reset to defaults by admin', { adminId: req.user.id });

    res.json({ message: 'Countdown settings reset to defaults successfully', settings: toResponse(DEFAULTS) });
  } catch (error) {
    logger.error('Error resetting countdown settings:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to reset countdown settings' });
  }
});

module.exports = router;

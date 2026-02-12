/**
 * Appends a single JSON line to .cursor/debug.log in the same format as Cursor's debug log,
 * so you can trace promo code flow (Edit open, Submit, PUT, GET) in one place.
 * Only writes when PROMO_DEBUG=1 or NODE_ENV=development.
 */
const fs = require('fs');
const path = require('path');

const DEBUG_LOG_PATH = path.join(__dirname, '..', '..', '.cursor', 'debug.log');

function isPromoDebugEnabled() {
  if (process.env.PROMO_DEBUG === '1' || process.env.PROMO_DEBUG === 'true') return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

function writeLine(obj) {
  if (!isPromoDebugEnabled()) return;
  const line = JSON.stringify({
    location: obj.location || 'promo',
    message: obj.message || '',
    data: obj.data || {},
    timestamp: Date.now(),
    ...(obj.hypothesisId && { hypothesisId: obj.hypothesisId })
  }) + '\n';
  try {
    const dir = path.dirname(DEBUG_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(DEBUG_LOG_PATH, line);
  } catch (err) {
    console.error('[promo-debug] Failed to write to debug.log:', err.message);
  }
}

module.exports = {
  isPromoDebugEnabled,
  write: writeLine
};

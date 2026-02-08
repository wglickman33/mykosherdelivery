import SunCalc from 'suncalc';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Get the current date string (YYYY-MM-DD) and minutes-from-midnight in a given IANA timezone.
 * @param {string} timezone - IANA timezone (e.g. America/New_York)
 * @returns {{ dateStr: string, minutesFromMidnight: number }}
 */
export function getNowInTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10);
    const minutesFromMidnight = d.getUTCHours() * 60 + d.getUTCMinutes();
    return { dateStr, minutesFromMidnight };
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '0';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const minutesFromMidnight = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
  return { dateStr, minutesFromMidnight };
}

/**
 * Get day-of-week (0=Sun, 6=Sat) for a date string in the given timezone.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timezone - IANA timezone
 * @returns {number} 0-6
 */
export function getDayOfWeekInTimezone(dateStr, timezone) {
  if (!timezone) {
    const d = new Date(dateStr + 'T12:00:00.000Z');
    return d.getUTCDay();
  }
  const date = new Date(dateStr + 'T12:00:00.000Z');
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  const short = formatter.format(date).toLowerCase();
  const idx = DAY_NAMES.findIndex((d) => short.startsWith(d));
  return idx >= 0 ? idx : 0;
}

/**
 * Get "After Shabbat" (1 hour after sunset) for the given date at (lat, lng), expressed as
 * minutes from midnight in the restaurant's timezone for that calendar day.
 * If sunset+1hr falls on the next calendar day in TZ, we return minutes for the next day (caller can use for "close" that crosses midnight).
 * @param {string} dateStr - YYYY-MM-DD (day for which we want sunset, in restaurant TZ)
 * @param {number} lat
 * @param {number} lng
 * @param {string} timezone - IANA timezone
 * @returns {{ minutesFromMidnight: number, dateStr: string }} dateStr is the calendar date in TZ when AS occurs
 */
export function getAfterShabbatMinutes(dateStr, lat, lng, timezone) {
  const date = new Date(dateStr + 'T12:00:00.000Z');
  const times = SunCalc.getTimes(date, lat, lng);
  const sunset = times.sunset;
  if (!sunset) return { minutesFromMidnight: 0, dateStr };
  const afterShabbat = new Date(sunset.getTime() + 60 * 60 * 1000);
  if (!timezone) {
    const minutesFromMidnight = afterShabbat.getUTCHours() * 60 + afterShabbat.getUTCMinutes();
    const ds = afterShabbat.toISOString().slice(0, 10);
    return { minutesFromMidnight, dateStr: ds };
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(afterShabbat);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '0';
  const outDateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const minutesFromMidnight = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
  return { minutesFromMidnight, dateStr: outDateStr };
}

/**
 * Parse a time string to minutes from midnight. Supports "9am", "9:30am", "5pm", "12pm", "12am", "AS" (caller resolves AS).
 * @param {string} s
 * @returns {number | 'AS' | null}
 */
function parseTime(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim().toUpperCase();
  if (t === 'AS') return 'AS';
  const match = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = (match[3] || '').toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Parse hours of operation text into a map: dayIndex (0-6) -> { open: number, close: number } | 'closed'.
 * Accepts one line per day. Separator between open and close can be hyphen (-) or en-dash (–).
 *
 * Supported formats (day name then tab or spaces, then time or Closed):
 *   Saturday    Closed
 *   Sunday      6 AM–3:30 PM
 *   Friday      6 AM–2:30 PM
 *   Saturday    AS–12 AM
 *   Saturday    AS–11 PM
 * Day names: full (Saturday, Sunday, …) or short (Sat, Sun, …). Times: 6 AM, 7:30 AM, 12 PM, 12 AM, or AS (after Shabbat).
 *
 * @param {string} hoursText
 * @returns {Record<number, { open: number, close: number } | 'closed'>}
 */
export function parseHoursOfOperation(hoursText) {
  const byDay = {};
  if (!hoursText || typeof hoursText !== 'string') return byDay;
  const lines = hoursText
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('closed')) {
      const dayPart = line.replace(/closed/i, '').trim();
      const days = parseDayRange(dayPart);
      for (const d of days) byDay[d] = 'closed';
      continue;
    }
    // Allow hyphen (-) or en-dash (–) between times
    const dashMatch = line.match(/\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|AS)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|AS)\s*$/i);
    if (!dashMatch) continue;
    const dayPart = line.slice(0, line.indexOf(dashMatch[0])).trim();
    const openRaw = dashMatch[1].trim();
    const closeRaw = dashMatch[2].trim();
    const open = parseTime(openRaw);
    const close = parseTime(closeRaw);
    if (open === null && openRaw.toUpperCase() !== 'AS') continue;
    if (close === null && closeRaw.toUpperCase() !== 'AS') continue;
    const days = parseDayRange(dayPart);
    for (const d of days) {
      byDay[d] = { open: open === 'AS' ? 'AS' : open, close: close === 'AS' ? 'AS' : close };
    }
  }
  return byDay;
}

function parseDayRange(dayPart) {
  if (!dayPart) return [0, 1, 2, 3, 4, 5, 6];
  const part = dayPart.toLowerCase().trim();
  const single = DAY_NAMES.findIndex((d) => part === d || part === DAY_NAMES_FULL[DAY_NAMES.indexOf(d)]);
  if (single >= 0) return [single];
  const fullNames = part.split(/[,&]/).map((p) => p.trim());
  const days = [];
  for (const p of fullNames) {
    const idx = DAY_NAMES.findIndex((d) => p.startsWith(d) || DAY_NAMES_FULL[DAY_NAMES.indexOf(d)].startsWith(p));
    if (idx >= 0) days.push(idx);
  }
  if (days.length) return days;
  const rangeMatch = part.match(/^(\w+)\s*-\s*(\w+)$/);
  if (rangeMatch) {
    const a = DAY_NAMES.findIndex((d) => rangeMatch[1].toLowerCase().startsWith(d));
    const b = DAY_NAMES.findIndex((d) => rangeMatch[2].toLowerCase().startsWith(d));
    if (a >= 0 && b >= 0) {
      const result = [];
      for (let i = a; ; i = (i + 1) % 7) {
        result.push(i);
        if (i === b) break;
      }
      return result;
    }
  }
  return [];
}

/**
 * Determine if a restaurant is open right now based on hours of operation, location (for AS), and timezone.
 * @param {string} hoursOfOperation - Raw hours text
 * @param {number} lat - Latitude (for sunset/AS)
 * @param {number} lng - Longitude (for sunset/AS)
 * @param {string} timezone - IANA timezone (e.g. America/New_York). If missing, uses UTC for "now" and AS.
 * @returns {boolean | null} true = open, false = closed, null = unknown (no hours or missing data)
 */
export function isOpenNow(hoursOfOperation, lat, lng, timezone) {
  if (!hoursOfOperation || typeof hoursOfOperation !== 'string' || hoursOfOperation.trim() === '') return null;
  const latNum = typeof lat === 'number' && !Number.isNaN(lat) ? lat : null;
  const lngNum = typeof lng === 'number' && !Number.isNaN(lng) ? lng : null;
  const tz = timezone && typeof timezone === 'string' ? timezone.trim() : null;

  const { dateStr, minutesFromMidnight: nowMins } = getNowInTimezone(tz || 'UTC');
  const dayOfWeek = getDayOfWeekInTimezone(dateStr, tz || 'UTC');
  const parsed = parseHoursOfOperation(hoursOfOperation);
  const today = parsed[dayOfWeek];
  if (today === undefined || today === 'closed') return false;

  let openMins = today.open;
  let closeMins = today.close;
  if (openMins === 'AS' || closeMins === 'AS') {
    if (latNum == null || lngNum == null) return null;
    const as = getAfterShabbatMinutes(dateStr, latNum, lngNum, tz || 'UTC');
    if (openMins === 'AS') openMins = as.minutesFromMidnight;
    if (closeMins === 'AS') closeMins = as.minutesFromMidnight;
  }
  if (typeof openMins !== 'number' || typeof closeMins !== 'number') return null;

  const overnight = closeMins < openMins;
  if (overnight) {
    return nowMins >= openMins || nowMins < closeMins;
  }
  return nowMins >= openMins && nowMins < closeMins;
}

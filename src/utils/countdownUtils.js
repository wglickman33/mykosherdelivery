/**
 * Get the current date/time components in a given IANA timezone.
 * Returns { day (0=Sun), hour, minute, second } all in that timezone.
 */
export const getTimeInTimezone = (timezone = 'America/New_York') => {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const dayName = parts.find(p => p.type === 'weekday').value;
  // hour12:false returns '24' for midnight in some browsers — normalize to 0
  const rawHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const second = parseInt(parts.find(p => p.type === 'second').value, 10);

  const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const day = dayMap[dayName];
  if (day === undefined) {
    console.warn('[countdownUtils] Unexpected weekday name from Intl:', dayName);
    return { day: new Date().getDay(), hour, minute, second };
  }

  return { day, hour, minute, second };
};

/**
 * Convert "next occurrence of weekday D at HH:MM in timezone TZ" to a JS Date (UTC).
 *
 * Strategy: advance `daysAhead` days from now (in UTC ms), read back the calendar
 * date in the target timezone, then compute the UTC instant that equals that
 * calendar date at the target wall-clock time in that timezone.
 * A one-step correction handles any DST offset difference.
 */
export const getNextTargetDate = (settings) => {
  const timezone = settings.timezone || 'America/New_York';
  const targetDay = settings.targetDay;
  const [targetHourStr, targetMinStr] = settings.targetTime.split(':');
  const targetHour = parseInt(targetHourStr, 10);
  const targetMinute = parseInt(targetMinStr, 10);

  const now = new Date();
  const current = getTimeInTimezone(timezone);

  // How many days ahead is the target weekday?
  let daysAhead = ((targetDay - current.day) + 7) % 7;

  // If today IS the target day, check if the time has already passed
  if (daysAhead === 0) {
    const alreadyPassed =
      current.hour > targetHour ||
      (current.hour === targetHour && current.minute >= targetMinute);
    if (alreadyPassed) {
      // In past-due window — keep countdown at zero; otherwise next deadline is next week
      daysAhead = isInPastDuePeriod(settings) ? 0 : 7;
    }
  }

  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Advance daysAhead full days from now (UTC), then read the calendar date in the TZ
  const baseDateMs = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;
  const baseParts = offsetFormatter.formatToParts(new Date(baseDateMs));
  const year  = parseInt(baseParts.find(p => p.type === 'year').value, 10);
  const month = parseInt(baseParts.find(p => p.type === 'month').value, 10) - 1;
  const day   = parseInt(baseParts.find(p => p.type === 'day').value, 10);

  // Naive UTC guess: treat the calendar date + target time as if UTC offset == browser offset
  const naiveUtcMs = Date.UTC(year, month, day, targetHour, targetMinute, 0) -
    (new Date(baseDateMs).getTimezoneOffset() * 60 * 1000);

  // Correct for the actual TZ offset (handles DST)
  const checkParts = offsetFormatter.formatToParts(new Date(naiveUtcMs));
  const h1 = parseInt(checkParts.find(p => p.type === 'hour').value, 10) % 24;
  const m1 = parseInt(checkParts.find(p => p.type === 'minute').value, 10);
  const diffMs = ((targetHour - h1) * 60 + (targetMinute - m1)) * 60 * 1000;

  return new Date(naiveUtcMs + diffMs);
};

/**
 * Returns true when we are in the "orders closed" window:
 * from targetDay@targetTime up to (but not including) resetDay@resetTime.
 *
 * Handles week-wrap correctly (e.g. target=Thursday, reset=Sunday).
 */
export const isInPastDuePeriod = (settings) => {
  const timezone = settings.timezone || 'America/New_York';
  const current = getTimeInTimezone(timezone);

  const targetDay = settings.targetDay;
  const [th, tm] = settings.targetTime.split(':').map(Number);
  const resetDay = settings.resetDay;
  const [rh, rm] = settings.resetTime.split(':').map(Number);

  // Convert everything to "minutes since start of week (Sunday = 0)"
  const toWeekMinutes = (day, hour, minute) => day * 24 * 60 + hour * 60 + minute;

  const targetMinutes = toWeekMinutes(targetDay, th, tm);
  const resetMinutes  = toWeekMinutes(resetDay,  rh, rm);
  const nowMinutes    = toWeekMinutes(current.day, current.hour, current.minute);

  if (targetMinutes === resetMinutes) return false; // degenerate — treat as never past-due

  if (targetMinutes < resetMinutes) {
    // Normal case: target is earlier in the week than reset (e.g. Thu 18:00 → Sat 00:00)
    return nowMinutes >= targetMinutes && nowMinutes < resetMinutes;
  } else {
    // Wrap case: target is later in the week than reset (e.g. Sat 22:00 → Mon 08:00)
    // Past-due window wraps around Sunday midnight.
    return nowMinutes >= targetMinutes || nowMinutes < resetMinutes;
  }
};

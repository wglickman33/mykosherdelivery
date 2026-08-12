/**
 * Nursing-home meal pricing, validation, and NY deadline helpers.
 */
export const NH_MEAL_PRICES = {
  breakfast: 15,
  lunch: 21,
  dinner: 23
};

export const NH_TAX_RATE = 0.08875;

const normCat = (c) => String(c || '').toLowerCase();

export const isNoneMeal = (meal) =>
  !meal || meal.none === true || meal.skipped === true ||
  (Array.isArray(meal.items) && meal.items.some((i) => i?.id === 'none' || i?.name === 'None'));

export const mealHasItems = (meal) =>
  meal && !isNoneMeal(meal) && Array.isArray(meal.items) && meal.items.length > 0;

const itemNeedsBagelType = (item) => {
  if (item?.requiresBagelType === true) return true;
  const name = item?.name != null ? String(item.name) : '';
  return /bagel/i.test(name) && !/type/i.test(name);
};

const mainsExcludeSide = (mains) => mains.some((i) => i.excludesSide === true);

export const validateMealSelection = (mealType, meal) => {
  if (!meal || isNoneMeal(meal)) return null;
  const items = meal.items || [];
  if (items.length === 0) return null;

  const mains = items.filter((i) => ['main', 'entree'].includes(normCat(i.category)));
  const sides = items.filter((i) => normCat(i.category) === 'side');
  const soups = items.filter((i) => normCat(i.category) === 'soup');
  const desserts = items.filter((i) => normCat(i.category) === 'dessert');
  const skipSide = mainsExcludeSide(mains);

  if (mealType === 'breakfast') {
    if (mains.length !== 1) return 'Breakfast requires exactly one main';
    if (skipSide) {
      if (sides.length > 0) return 'This main does not include a side';
    } else if (sides.length !== 1) {
      return 'Breakfast requires exactly one side';
    }
    const needsBagel = mains.some(itemNeedsBagelType);
    if (needsBagel && !meal.bagelType) return 'Select a bagel type for breakfast';
    if (soups.length || desserts.length) {
      return skipSide
        ? 'Breakfast only allows one main when side is excluded'
        : 'Breakfast only allows one main and one side';
    }
  }

  if (mealType === 'lunch') {
    if (mains.length !== 1) return 'Lunch requires exactly one entree';
    if (skipSide) {
      if (sides.length > 0) return 'This entree does not include a side';
    } else if (sides.length !== 1) {
      return 'Lunch requires exactly one side';
    }
    if (soups.length || desserts.length) {
      return skipSide
        ? 'Lunch only allows one entree when side is excluded'
        : 'Lunch only allows one entree and one side';
    }
  }

  if (mealType === 'dinner') {
    if (mains.length !== 1) return 'Dinner requires exactly one entree';
    if (skipSide) {
      if (sides.length > 0) return 'This entree does not include a side';
    } else if (sides.length !== 1) {
      return 'Dinner requires exactly one side';
    }
    if (soups.length > 1) return 'Dinner allows at most one soup';
    if (desserts.length > 1) return 'Dinner allows at most one dessert';
  }

  return null;
};

export const validateWeeklyMeals = (mealsMap) => {
  const errors = [];
  Object.values(mealsMap || {}).forEach((meal) => {
    if (!mealHasItems(meal) && !isNoneMeal(meal)) return;
    const err = validateMealSelection(meal.mealType, meal);
    if (err) errors.push(`${meal.day} ${meal.mealType}: ${err}`);
  });
  return errors;
};

/** Subtotal using fixed meal prices (not item sum) for ordered meals only. */
export const calculateNhOrderTotals = (mealsMap) => {
  let subtotal = 0;
  let mealCount = 0;
  Object.values(mealsMap || {}).forEach((meal) => {
    if (!mealHasItems(meal)) return;
    const price = NH_MEAL_PRICES[meal.mealType] ?? 0;
    subtotal += price;
    mealCount += 1;
  });
  const tax = Math.round(subtotal * NH_TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total, mealCount };
};

const getPartsInTz = (date, timeZone) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdayMap[get('weekday')] ?? date.getDay(),
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10) % 24,
    minute: parseInt(get('minute'), 10)
  };
};

/** Next Sunday 12:00 America/New_York as a Date (approx wall time). */
export const getNhOrderDeadline = (timeZone = 'America/New_York') => {
  const now = new Date();
  const cur = getPartsInTz(now, timeZone);
  let daysUntilSunday = (7 - cur.weekday) % 7;
  if (daysUntilSunday === 0 && (cur.hour > 12 || (cur.hour === 12 && cur.minute >= 0))) {
    // If it's Sunday after/at noon, deadline was today — still show today's noon for display;
    // submit will be blocked by backend. If past noon, next week's Sunday.
    if (cur.hour > 12 || (cur.hour === 12 && cur.minute > 0)) {
      daysUntilSunday = 7;
    }
  }
  const target = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
  // Build a Date representing that calendar day at 12:00 ET approximately
  const targetParts = getPartsInTz(target, timeZone);
  // Use noon ET via ISO-ish construction: treat as local noon adjusted — good enough for display
  const display = new Date(
    Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day, 17, 0, 0)
  ); // 12:00 ET ≈ 17:00 UTC (EST) — DST may shift; UI uses toLocaleString with timeZone
  return display;
};

export const formatNhDeadline = (date = getNhOrderDeadline()) =>
  date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

export const getNextMondayDateString = (timeZone = 'America/New_York') => {
  const now = new Date();
  const cur = getPartsInTz(now, timeZone);
  const daysUntilMonday = cur.weekday === 0 ? 1 : (8 - cur.weekday) % 7 || 7;
  const monday = new Date(now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  const p = getPartsInTz(monday, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

export const addDaysToDateString = (isoDate, days) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

export const getOrderStatusPill = (order) => {
  if (!order) return { key: 'needs', label: 'Needs order' };
  if (order.status === 'draft') return { key: 'draft', label: 'Draft' };
  if (['submitted', 'confirmed', 'paid'].includes(order.status) || order.paymentStatus === 'paid') {
    return { key: 'ordered', label: 'Ordered' };
  }
  if (order.paymentStatus === 'pending' || order.paymentStatus === 'pending_monthly') {
    return { key: 'pending', label: 'Submitted' };
  }
  return { key: 'needs', label: 'Needs order' };
};

/** True when order was placed by staff/admin rather than the resident login. */
export const isStaffPlacedOrder = (order, resident, currentUserId = null) => {
  if (!order) return false;
  const creator = order.createdBy;
  const creatorId = order.createdByUserId || creator?.id;
  if (!creatorId) return false;
  if (currentUserId && creatorId === currentUserId) return false;
  if (resident?.userId && creatorId === resident.userId) return false;
  if (creator?.role === 'nursing_home_user') return false;
  if (creator?.role === 'nursing_home_admin' || creator?.role === 'admin') return true;
  // Creator differs from the linked resident login → treat as staff-placed
  return Boolean(resident?.userId && creatorId !== resident.userId);
};

export const formatAssignedStaffContact = (assignedUser) => {
  if (!assignedUser) return null;
  const name = [assignedUser.firstName, assignedUser.lastName].filter(Boolean).join(' ').trim();
  const parts = [name || null, assignedUser.email || null, assignedUser.phone || null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
};

export const ADMIN_ALREADY_ORDERED_MESSAGE =
  'A facility administrator has already placed an order for you this week. Contact them with any questions.';


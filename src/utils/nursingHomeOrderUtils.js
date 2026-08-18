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

export const NH_CATEGORY_LABELS = {
  main: 'Mains',
  side: 'Sides',
  entree: 'Entrees',
  soup: 'Soups',
  dessert: 'Desserts'
};

export const formatNhCategoryLabel = (category) => {
  const key = String(category || '').toLowerCase();
  if (!key) return '';
  return NH_CATEGORY_LABELS[key] || `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
};

export const isNoneMeal = (meal) =>
  Boolean(meal) && (
    meal.none === true ||
    meal.skipped === true ||
    (Array.isArray(meal.items) && meal.items.some((i) => i?.id === 'none' || i?.name === 'None'))
  );

export const mealHasItems = (meal) =>
  meal && !isNoneMeal(meal) && Array.isArray(meal.items) && meal.items.length > 0;

export const isMealSlotComplete = (meal) => mealHasItems(meal) || isNoneMeal(meal);

export const isDayComplete = (mealsMap, day) =>
  ['breakfast', 'lunch', 'dinner'].every((mealType) =>
    isMealSlotComplete(mealsMap?.[`${day}-${mealType}`])
  );

export const NH_MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

export const getMealKey = (day, mealType) => `${day}-${mealType}`;

/** How many of breakfast/lunch/dinner are confirmed for a day. */
export const getDayProgress = (mealsMap, day) => {
  const filled = NH_MEAL_TYPES.filter((mealType) =>
    isMealSlotComplete(mealsMap?.[getMealKey(day, mealType)])
  ).length;
  return { filled, total: NH_MEAL_TYPES.length, complete: filled === NH_MEAL_TYPES.length };
};

export const cloneMealForDay = (meal, targetDay) => {
  if (!meal) return null;
  const none = isNoneMeal(meal);
  return {
    day: targetDay,
    mealType: meal.mealType,
    items: none
      ? []
      : (meal.items || []).map((item) => ({ ...item })),
    bagelType: none ? null : (meal.bagelType || null),
    none
  };
};

/**
 * Copy confirmed meals from sourceDay onto each target day (overwrites those slots).
 * Returns a new meals map.
 */
export const copyDayToDays = (mealsMap, sourceDay, targetDays = []) => {
  const next = { ...(mealsMap || {}) };
  const targets = (targetDays || []).filter((d) => d && d !== sourceDay);

  NH_MEAL_TYPES.forEach((mealType) => {
    const source = mealsMap?.[getMealKey(sourceDay, mealType)];
    if (!isMealSlotComplete(source)) return;
    targets.forEach((day) => {
      next[getMealKey(day, mealType)] = cloneMealForDay(source, day);
    });
  });

  return next;
};

export const getNextMealNavLabel = (
  day,
  mealType,
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  mealTypes = NH_MEAL_TYPES
) => {
  const mealIndex = mealTypes.indexOf(mealType);
  if (mealIndex >= 0 && mealIndex < mealTypes.length - 1) {
    const next = mealTypes[mealIndex + 1];
    return `Next: ${next.charAt(0).toUpperCase() + next.slice(1)}`;
  }
  const dayIndex = days.indexOf(day);
  if (dayIndex >= 0 && dayIndex < days.length - 1) {
    return `Next Day: ${days[dayIndex + 1]}`;
  }
  return 'Review order';
};

export const isLastMealSlot = (
  day,
  mealType,
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  mealTypes = NH_MEAL_TYPES
) => day === days[days.length - 1] && mealType === mealTypes[mealTypes.length - 1];

const itemNeedsBagelType = (item) => {
  if (item?.requiresBagelType === true) return true;
  const name = item?.name != null ? String(item.name) : '';
  return /bagel/i.test(name) && !/type/i.test(name);
};

const mainsExcludeSide = (mains) => mains.some((i) => i.excludesSide === true);

/** Soft validation hints while selecting (before Next). */
export const getMealSelectionHints = (mealType, meal) => {
  if (!meal || isNoneMeal(meal)) return [];
  const items = meal.items || [];
  if (items.length === 0) return [];

  const hints = [];
  const mains = items.filter((i) => ['main', 'entree'].includes(normCat(i.category)));
  const sides = items.filter((i) => normCat(i.category) === 'side');
  const skipSide = mainsExcludeSide(mains);
  const needsBagel = mains.some(itemNeedsBagelType);

  if (mealType === 'breakfast' || mealType === 'lunch') {
    const mainLabel = mealType === 'breakfast' ? 'main' : 'entree';
    if (mains.length === 0) hints.push({ category: 'main', message: `Choose a ${mainLabel}` });
    if (!skipSide && mains.length > 0 && sides.length === 0) {
      hints.push({ category: 'side', message: 'Choose a side' });
    }
  }

  if (mealType === 'dinner') {
    if (mains.length === 0) hints.push({ category: 'main', message: 'Choose an entree' });
    if (!skipSide && mains.length > 0 && sides.length === 0) {
      hints.push({ category: 'side', message: 'Choose a side' });
    }
  }

  if (needsBagel && !meal.bagelType) {
    hints.push({ category: 'bagel', message: 'Choose a bagel type' });
  }

  return hints;
};

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

/** Next Sunday 12:00 America/New_York as a Date. */
export const getNhOrderDeadline = (timeZone = 'America/New_York') => {
  const now = new Date();
  const cur = getPartsInTz(now, timeZone);
  let daysUntilSunday = (7 - cur.weekday) % 7;
  if (daysUntilSunday === 0 && (cur.hour > 12 || (cur.hour === 12 && cur.minute > 0))) {
    daysUntilSunday = 7;
  }
  const target = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
  const targetParts = getPartsInTz(target, timeZone);
  const y = targetParts.year;
  const m = targetParts.month;
  const d = targetParts.day;

  // Find the UTC instant that is exactly 12:00 in America/New_York (handles EST/EDT)
  for (let utcHour = 14; utcHour <= 18; utcHour += 1) {
    const candidate = new Date(Date.UTC(y, m - 1, d, utcHour, 0, 0));
    const parts = getPartsInTz(candidate, timeZone);
    if (parts.year === y && parts.month === m && parts.day === d && parts.hour === 12 && parts.minute === 0) {
      return candidate;
    }
  }

  return new Date(Date.UTC(y, m - 1, d, 16, 0, 0));
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

/** Format a DATEONLY YYYY-MM-DD string without timezone shift. */
export const formatNhDate = (isoDate, { weekday = 'long' } = {}) => {
  if (!isoDate) return '—';
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(isoDate);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return String(isoDate);
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  if (weekday) opts.weekday = weekday;
  return date.toLocaleDateString('en-US', opts);
};

export const formatNhWeekRange = (start, end) => {
  const startLabelFull = formatNhDate(start, { weekday: false });
  if (!end) return startLabelFull;
  const startMatch = String(start || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const endMatch = String(end || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
    const startDate = new Date(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${formatNhDate(end, { weekday: false })}`;
  }
  return `${startLabelFull} – ${formatNhDate(end, { weekday: false })}`;
};

export const NH_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const NH_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  paid: 'Paid',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded'
};

export const NH_PAYMENT_LABELS = {
  pending: 'Pending',
  pending_monthly: 'Billed monthly',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded'
};

export const formatNhEnumLabel = (value, map = {}) => {
  if (value == null || value === '') return '—';
  const key = String(value).toLowerCase();
  if (map[key]) return map[key];
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const formatNhStatusLabel = (status) => formatNhEnumLabel(status, NH_STATUS_LABELS);
export const formatNhPaymentLabel = (status) => formatNhEnumLabel(status, NH_PAYMENT_LABELS);

export const getNhMealItemLines = (meal) => {
  if (!meal || isNoneMeal(meal)) return [];
  return (meal.items || [])
    .filter((item) => item && item.id !== 'none' && item.name !== 'None')
    .map((item) => ({
      name: item.name,
      note: meal.bagelType && itemNeedsBagelType(item) ? meal.bagelType : null,
      category: item.category || null
    }));
};

export const groupNhMealsByDay = (meals) => {
  const list = Array.isArray(meals) ? meals : [];
  return NH_DAYS.map((day) => {
    const slots = NH_MEAL_TYPES.map((mealType) => {
      const meal = list.find((m) => m.day === day && m.mealType === mealType) || null;
      return { mealType, meal };
    });
    const selectedCount = slots.filter(({ meal }) => mealHasItems(meal)).length;
    const hasAny = slots.some(({ meal }) => meal && (mealHasItems(meal) || isNoneMeal(meal)));
    return { day, slots, selectedCount, hasAny };
  }).filter((d) => d.hasAny);
};

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

/** Fixed NH order deadline countdown — Sunday 12:00 America/New_York (not AdminSettings). */
export const NH_ORDER_COUNTDOWN_SETTINGS = {
  targetDay: 0,
  targetTime: '12:00',
  resetDay: 1,
  resetTime: '00:00',
  timezone: 'America/New_York',
  targetDayName: 'Sunday',
  resetDayName: 'Monday'
};

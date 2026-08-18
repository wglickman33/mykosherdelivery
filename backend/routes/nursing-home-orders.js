const express = require('express');
const rateLimit = require('express-rate-limit');
const { 
  NursingHomeOrder, 
  NursingHomeResidentOrder, 
  NursingHomeRefund,
  NursingHomeResident, 
  NursingHomeFacility, 
  NursingHomeMenuItem,
  Profile 
} = require('../models');
const { Op } = require('sequelize');
const { requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const { generateOrderNumber: generateBaseOrderNumber } = require('../services/orderService');
const { NH_CONFIG, API_CONFIG, ORDER_CONFIG } = require('../config/constants');
const logger = require('../utils/logger');
const { createAdminNotification } = require('../utils/adminNotifications');
const { logAdminAction } = require('../utils/auditLog');
const ExcelJS = require('exceljs');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== 'string' || key.includes('placeholder')) return null;
  return require('stripe')(key);
}
let stripeClient = null;
function stripe() {
  if (stripeClient === null) stripeClient = getStripe();
  return stripeClient;
}
if (!stripe()) {
  logger.warn('STRIPE_SECRET_KEY not set; nursing home payment routes will fail');
}

const NH_EXPORT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const NH_EXPORT_MEALS = ['breakfast', 'lunch', 'dinner'];

function formatNhExportDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatNhExportWeek(start, end) {
  const a = formatNhExportDate(start);
  const b = formatNhExportDate(end);
  if (a && b) return `${a} – ${b}`;
  return a || b || '';
}

function formatNhExportEnum(value, map) {
  if (!value) return '';
  return map[value] || String(value).replace(/_/g, ' ');
}

const NH_EXPORT_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  paid: 'Paid',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const NH_EXPORT_PAYMENT_LABELS = {
  pending: 'Pending',
  pending_monthly: 'Billed monthly',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded'
};

function isSkippedExportMeal(meal) {
  if (!meal) return true;
  if (meal.none === true || meal.skipped === true) return true;
  const items = Array.isArray(meal.items) ? meal.items : [];
  if (items.some((i) => i?.id === 'none' || i?.name === 'None')) return true;
  return items.length === 0;
}

function exportItemNeedsBagel(item) {
  if (item?.requiresBagelType === true) return true;
  const name = item?.name != null ? String(item.name) : '';
  return /bagel/i.test(name) && !/type/i.test(name);
}

function formatMealExportCell(meal) {
  if (isSkippedExportMeal(meal)) return 'Skipped';
  const lines = (meal.items || [])
    .filter((i) => i && i.id !== 'none' && i.name !== 'None')
    .map((item) => {
      const bagel = meal.bagelType && exportItemNeedsBagel(item) ? ` (${meal.bagelType})` : '';
      return `• ${item.name}${bagel}`;
    });
  return lines.length ? lines.join('\n') : 'Skipped';
}

function styleExportHeaderRow(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF061757' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 22;
}

const router = express.Router();

router.get('/residents', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', facilityId, assignedUserId } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (req.user.role === 'admin') {
      if (facilityId) where.facilityId = facilityId;
    } else if (req.user.role === 'nursing_home_admin' || req.user.role === 'nursing_home_user') {
      where.facilityId = req.user.nursingHomeFacilityId;
    }
    if (assignedUserId && (req.user.role === 'admin' || req.user.role === 'nursing_home_admin')) {
      where.assignedUserId = assignedUserId;
    }
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: residents } = await NursingHomeResident.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit, 10) || 50, 100),
      offset,
      order: [['name', 'ASC']],
      include: [
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name'] },
        { model: Profile, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });

    res.json({
      success: true,
      data: residents,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / (parseInt(limit, 10) || 50))
      }
    });
  } catch (error) {
    logger.error('Error fetching residents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch residents',
      message: error.message
    });
  }
});

router.get('/residents/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const resident = await NursingHomeResident.findByPk(req.params.id, {
      include: [
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name', 'address'] },
        { model: Profile, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] }
      ]
    });
    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }
    if (!canAccessFacilityResident(req.user, resident)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    res.json({ success: true, data: resident });
  } catch (error) {
    logger.error('Error fetching resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resident',
      message: error.message
    });
  }
});

router.get('/menu', requireNursingHomeUser, async (req, res) => {
  try {
    const { mealType, category, isActive = 'true' } = req.query;
    const where = { isActive: isActive === 'true' };
    if (mealType) where.mealType = mealType;
    if (category) where.category = category;

    const menuItems = await NursingHomeMenuItem.findAll({
      where,
      order: [['mealType', 'ASC'], ['category', 'ASC'], ['displayOrder', 'ASC']]
    });

    const groupedMenu = {
      breakfast: { main: [], side: [] },
      lunch: { entree: [], side: [] },
      dinner: { entree: [], side: [], soup: [], dessert: [] }
    };
    menuItems.forEach(item => {
      if (groupedMenu[item.mealType] && groupedMenu[item.mealType][item.category]) {
        groupedMenu[item.mealType][item.category].push(item);
      }
    });

    res.json({
      success: true,
      data: { items: menuItems, grouped: groupedMenu }
    });
  } catch (error) {
    logger.error('Error fetching menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu',
      message: error.message
    });
  }
});

router.get('/menu/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const menuItem = await NursingHomeMenuItem.findByPk(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }
    res.json({ success: true, data: menuItem });
  } catch (error) {
    logger.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item',
      message: error.message
    });
  }
});

const paymentLimiter = rateLimit({
  windowMs: API_CONFIG.RATE_LIMIT.WINDOW_MS,
  max: API_CONFIG.RATE_LIMIT.PAYMENT_MAX_REQUESTS,
  message: 'Too many payment attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

function toDateOnlyString(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

const validateQueryParams = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('residentId').optional().isUUID(),
  query('facilityId').optional().isUUID(),
  query('status').optional().isIn(Object.values(NH_CONFIG.STATUSES)),
  query('paymentStatus').optional().isIn(Object.values(NH_CONFIG.PAYMENT_STATUSES)),
  query('weekStartDate').optional().isISO8601().customSanitizer((v) => toDateOnlyString(v) || v),
  query('orderNumber').optional().isString().trim().isLength({ min: 1, max: 64 })
];

const validateResidentOrder = [
  body('residentId').isUUID(),
  body('weekStartDate').isISO8601().customSanitizer((v) => toDateOnlyString(v) || v),
  body('weekEndDate').isISO8601().customSanitizer((v) => toDateOnlyString(v) || v),
  body('meals').isArray({ min: NH_CONFIG.MEALS.MIN_ITEMS_PER_MEAL, max: NH_CONFIG.MEALS.MAX_MEALS_PER_WEEK }),
  body('meals.*.day').isIn(NH_CONFIG.MEALS.DAYS),
  body('meals.*.mealType').isIn(NH_CONFIG.MEALS.TYPES),
  body('meals.*.items').optional().isArray({ min: 0, max: NH_CONFIG.MEALS.MAX_ITEMS_PER_MEAL }),
  body('meals.*.items.*.id').optional().isUUID(),
  body('meals.*.none').optional().isBoolean(),
  body('deliveryAddress').isObject(),
  body('deliveryAddress.street').isString().trim().isLength({ min: 1, max: 200 }),
  body('deliveryAddress.city').isString().trim().isLength({ min: 1, max: 100 }),
  body('deliveryAddress.state').isString().trim().isLength({ min: 2, max: 2 }),
  body('deliveryAddress.zip_code').isString().trim().matches(/^\d{5}$/),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim().isLength({ min: 1, max: 200 })
];

const validateOrderUpdate = [
  body('meals').optional().isArray({ min: NH_CONFIG.MEALS.MIN_ITEMS_PER_MEAL, max: NH_CONFIG.MEALS.MAX_MEALS_PER_WEEK }),
  body('meals.*.day').optional().isIn(NH_CONFIG.MEALS.DAYS),
  body('meals.*.mealType').optional().isIn(NH_CONFIG.MEALS.TYPES),
  body('meals.*.items').optional().isArray({ min: 0, max: NH_CONFIG.MEALS.MAX_ITEMS_PER_MEAL }),
  body('meals.*.items.*.id').optional().isUUID(),
  body('meals.*.none').optional().isBoolean(),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 })
];

const validateBulkOrder = [
  body('facilityId').isUUID(),
  body('weekStartDate').isDate(),
  body('weekEndDate').isDate(),
  body('residentMeals').isArray(),
  body('deliveryAddress').isObject()
];

const MEAL_PRICES = {
  breakfast: 15.00,
  lunch: 21.00,
  dinner: 23.00
};

function calculateDeadline(weekStartDate) {
  // Orders for a week starting Monday are due the previous Sunday at 12:00 America/New_York
  const dateOnly = toDateOnlyString(weekStartDate);
  if (!dateOnly) {
    throw new Error('Invalid weekStartDate for deadline calculation');
  }
  const start = new Date(`${dateOnly}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid weekStartDate for deadline calculation');
  }
  const sundayUtcGuess = new Date(start);
  sundayUtcGuess.setUTCDate(start.getUTCDate() - 1);

  const timeZone = NH_CONFIG.DEADLINE.TIMEZONE || 'America/New_York';
  const hour = NH_CONFIG.DEADLINE.HOUR ?? 12;
  const minute = NH_CONFIG.DEADLINE.MINUTE ?? 0;

  // Walk a few candidate UTC instants around noon ET on that calendar Sunday
  const y = sundayUtcGuess.getUTCFullYear();
  const m = sundayUtcGuess.getUTCMonth();
  const d = sundayUtcGuess.getUTCDate();

  for (let utcHour = 14; utcHour <= 18; utcHour++) {
    const candidate = new Date(Date.UTC(y, m, d, utcHour, minute, 0));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(candidate);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const weekday = get('weekday');
    const h = parseInt(get('hour'), 10) % 24;
    const min = parseInt(get('minute'), 10);
    if (weekday === 'Sun' && h === hour && min === minute) {
      return candidate;
    }
  }

  // Fallback: previous calendar day at 17:00 UTC (~12:00 EST)
  return new Date(Date.UTC(y, m, d, 17, minute, 0));
}

function generateOrderNumber() {
  return generateBaseOrderNumber(ORDER_CONFIG.NUMBER_PREFIX.NURSING_HOME_RESIDENT);
}

function generateBulkOrderNumber() {
  return generateBaseOrderNumber(ORDER_CONFIG.NUMBER_PREFIX.NURSING_HOME_BULK);
}

function isNoneMeal(meal) {
  if (!meal) return true;
  if (meal.none === true || meal.isNone === true || meal.skipped === true) return true;
  if (typeof meal.selection === 'string' && meal.selection.toLowerCase() === 'none') return true;
  if (!meal.items || !Array.isArray(meal.items) || meal.items.length === 0) return true;
  return meal.items.every((item) => {
    if (!item) return true;
    if (item.none === true) return true;
    const id = item.id != null ? String(item.id).toLowerCase() : '';
    const name = item.name != null ? String(item.name).toLowerCase() : '';
    return id === 'none' || name === 'none';
  });
}

function normCat(category) {
  return String(category || '').toLowerCase();
}

function itemNeedsBagelType(item) {
  if (item?.requiresBagelType === true) return true;
  const name = item?.name != null ? String(item.name) : '';
  return /bagel/i.test(name) && !/type/i.test(name);
}

function mainsExcludeSide(mains) {
  return mains.some((i) => i.excludesSide === true);
}

function validateMealComposition(meal) {
  if (isNoneMeal(meal)) return null;
  const mealType = meal.mealType;
  const items = Array.isArray(meal.items) ? meal.items : [];
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
}

function validateMealsComposition(meals) {
  const errors = [];
  (meals || []).forEach((meal) => {
    const err = validateMealComposition(meal);
    if (err) {
      errors.push(`${meal.day || ''} ${meal.mealType || ''}: ${err}`.trim());
    }
  });
  return errors;
}

function canAccessFacilityResident(user, resident) {
  if (!resident) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'nursing_home_admin') {
    return resident.facilityId === user.nursingHomeFacilityId;
  }
  if (user.role === 'nursing_home_user') {
    return resident.userId === user.id;
  }
  return false;
}

function assertFacilityOrderAccess(user, order) {
  if (user.role === 'admin') return true;
  if (user.role === 'nursing_home_admin') {
    return order.facilityId === user.nursingHomeFacilityId;
  }
  if (user.role === 'nursing_home_user') {
    const linkedUserId = order.resident?.userId;
    if (linkedUserId == null) return false;
    return linkedUserId === user.id;
  }
  return false;
}

async function findResidentForNhUser(userId) {
  return NursingHomeResident.findOne({
    where: { userId, isActive: true },
    include: [{ model: NursingHomeFacility, as: 'facility' }]
  });
}

async function findActiveWeekOrder(residentId, weekStartDate) {
  const dateOnly = toDateOnlyString(weekStartDate) || String(weekStartDate || '').slice(0, 10);
  const orders = await NursingHomeResidentOrder.findAll({
    where: {
      residentId,
      status: { [Op.ne]: 'cancelled' }
    },
    order: [['updatedAt', 'DESC']],
    limit: 40
  });
  return orders.find((o) => toDateOnlyString(o.weekStartDate) === dateOnly) || null;
}

function nhUserStaffOrderConflict(order, user) {
  if (!order || user?.role !== 'nursing_home_user') return null;
  if (order.createdByUserId === user.id) return null;
  return {
    code: 'ADMIN_ALREADY_ORDERED',
    message:
      'A facility administrator has already placed an order for you this week. Contact them with any questions.'
  };
}

function isUniqueWeekViolation(error) {
  const name = error?.name || '';
  const msg = String(error?.message || error?.original?.message || '');
  return (
    name === 'SequelizeUniqueConstraintError' &&
    (msg.includes('nursing_home_resident_orders_resident_week_unique') ||
      msg.includes('resident_week') ||
      (msg.includes('resident_id') && msg.includes('week_start_date')))
  );
}

async function calculateOrderTotalsFromDB(meals) {
  let totalMeals = 0;
  let subtotal = 0;

  for (const meal of meals) {
    if (isNoneMeal(meal)) {
      continue;
    }

    if (!meal.items || !Array.isArray(meal.items)) {
      throw new Error('Invalid meal structure');
    }

    for (const item of meal.items) {
      if (!item?.id || String(item.id).toLowerCase() === 'none') continue;
      const menuItem = await NursingHomeMenuItem.findByPk(item.id);

      if (!menuItem) {
        throw new Error(`Menu item not found: ${item.id}`);
      }

      if (!menuItem.isActive) {
        throw new Error(`Menu item is not available: ${menuItem.name}`);
      }
    }

    const mealPrice = MEAL_PRICES[meal.mealType] || 0;
    if (mealPrice > 0) {
      totalMeals++;
      subtotal += mealPrice;
    }
  }

  const tax = subtotal * NH_CONFIG.BILLING.TAX_RATE;
  const total = subtotal + tax;

  return {
    totalMeals,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

function calculateBulkOrderTotals(residentMeals) {
  let totalMeals = 0;
  let subtotal = 0;

  residentMeals.forEach(resident => {
    resident.meals.forEach(meal => {
      if (isNoneMeal(meal)) return;
      totalMeals++;
      subtotal += MEAL_PRICES[meal.mealType] || 0;
    });
  });

  const tax = subtotal * NH_CONFIG.BILLING.TAX_RATE;
  const total = subtotal + tax;

  return {
    totalMeals,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

router.get('/resident-orders', requireNursingHomeUser, validateQueryParams, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 500);
    const offset = (page - 1) * limit;
    const { residentId, status, paymentStatus, weekStartDate, orderNumber } = req.query;

    const where = {};

    if (residentId) {
      where.residentId = residentId;
      
      if (req.user.role === 'nursing_home_user' || req.user.role === 'nursing_home_admin') {
        const resident = await NursingHomeResident.findByPk(residentId);
        if (!resident || !canAccessFacilityResident(req.user, resident)) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      }
    } else if (req.user.role === 'nursing_home_user') {
      const myResident = await findResidentForNhUser(req.user.id);
      if (!myResident) {
        return res.json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: parseInt(limit) || 20, totalPages: 0 }
        });
      }
      where.residentId = myResident.id;
    }

    if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    } else if (req.user.role === 'admin') {
      if (req.query.facilityId) {
        where.facilityId = req.query.facilityId;
      }
    }

    if (status) {
      where.status = status;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (weekStartDate) {
      where.weekStartDate = weekStartDate;
    }
    if (orderNumber) {
      const term = String(orderNumber).trim().replace(/[%_]/g, '');
      if (term) {
        where.orderNumber = { [Op.iLike]: `%${term}%` };
      }
    }

    const { count, rows: orders } = await NursingHomeResidentOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: NursingHomeResident,
          as: 'resident',
          attributes: ['id', 'name', 'roomNumber']
        },
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name']
        },
        {
          model: Profile,
          as: 'createdBy',
          attributes: ['id', 'firstName', 'lastName', 'role']
        }
      ]
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching resident orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

router.post('/resident-orders', requireNursingHomeUser, validateResidentOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { residentId, weekStartDate, weekEndDate, meals, deliveryAddress, billingEmail, billingName } = req.body;

    const resident = await NursingHomeResident.findByPk(residentId, {
      include: [{
        model: NursingHomeFacility,
        as: 'facility'
      }]
    });

    if (!resident) {
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (!resident.isActive) {
      return res.status(400).json({
        success: false,
        code: 'RESIDENT_INACTIVE',
        error: 'RESIDENT_INACTIVE',
        message: 'This resident is inactive and cannot receive orders'
      });
    }

    if (!canAccessFacilityResident(req.user, resident)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const weekStart = toDateOnlyString(weekStartDate) || weekStartDate;
    const weekEnd = toDateOnlyString(weekEndDate) || weekEndDate;

    if (req.user.role === 'nursing_home_user' && resident.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only order for yourself'
      });
    }

    const existing = await findActiveWeekOrder(residentId, weekStart);

    if (existing) {
      if (req.user.role === 'nursing_home_user') {
        const conflict = nhUserStaffOrderConflict(existing, req.user);
        if (conflict) {
          return res.status(409).json({
            success: false,
            code: conflict.code,
            error: conflict.code,
            message: conflict.message,
            data: { orderId: existing.id, status: existing.status }
          });
        }
        if (existing.status !== 'draft') {
          return res.status(409).json({
            success: false,
            code: 'ORDER_WEEK_EXISTS',
            error: 'ORDER_WEEK_EXISTS',
            message: 'You already have an order for this week. Open it from your dashboard.',
            data: { orderId: existing.id, status: existing.status }
          });
        }
      } else if (existing.status !== 'draft') {
        return res.status(409).json({
          success: false,
          code: 'ORDER_WEEK_EXISTS',
          error: 'ORDER_WEEK_EXISTS',
          message: 'An order already exists for this resident this week. Open the existing order to view or edit.',
          data: { orderId: existing.id, status: existing.status }
        });
      }
    }

    const compositionErrors = validateMealsComposition(meals);
    if (compositionErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid meal selection',
        message: compositionErrors[0],
        details: compositionErrors
      });
    }

    const deadline = calculateDeadline(weekStart);
    const totals = await calculateOrderTotalsFromDB(meals);

    if (existing && existing.status === 'draft') {
      await existing.update({
        meals,
        weekEndDate: weekEnd,
        totalMeals: totals.totalMeals,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        deliveryAddress: deliveryAddress || existing.deliveryAddress,
        deadline,
        billingEmail: billingEmail || resident.billingEmail || existing.billingEmail,
        billingName: billingName || resident.billingName || existing.billingName,
        residentName: resident.name,
        roomNumber: resident.roomNumber
      });

      logger.info('Resident order upserted (existing draft)', {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        residentId,
        updatedBy: req.user.id
      });

      return res.status(200).json({
        success: true,
        data: existing,
        upserted: true
      });
    }

    try {
      const order = await NursingHomeResidentOrder.create({
        residentId,
        facilityId: resident.facilityId,
        createdByUserId: req.user.id,
        orderNumber: generateOrderNumber(),
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals,
        status: 'draft',
        totalMeals: totals.totalMeals,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        paymentStatus: 'pending',
        deliveryAddress,
        deadline,
        residentName: resident.name,
        roomNumber: resident.roomNumber,
        billingEmail: billingEmail || resident.billingEmail,
        billingName: billingName || resident.billingName
      });

      logger.info('Resident order created', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        residentId,
        createdBy: req.user.id
      });

      return res.status(201).json({
        success: true,
        data: order
      });
    } catch (createError) {
      if (isUniqueWeekViolation(createError)) {
        const raced = await findActiveWeekOrder(residentId, weekStart);
        return res.status(409).json({
          success: false,
          code: 'ORDER_WEEK_EXISTS',
          error: 'ORDER_WEEK_EXISTS',
          message: 'An order already exists for this resident this week.',
          data: raced ? { orderId: raced.id, status: raced.status } : undefined
        });
      }
      throw createError;
    }
  } catch (error) {
    logger.error('Error creating resident order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

router.put('/resident-orders/:id', requireNursingHomeUser, validateOrderUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const { meals, billingEmail, billingName, notes } = req.body;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{
        model: NursingHomeResident,
        as: 'resident'
      }]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (!assertFacilityOrderAccess(req.user, order)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      const myResident = await findResidentForNhUser(req.user.id);
      if (!myResident || order.residentId !== myResident.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      const conflict = nhUserStaffOrderConflict(order, req.user);
      if (conflict) {
        return res.status(409).json({
          success: false,
          code: conflict.code,
          error: conflict.code,
          message: conflict.message,
          data: { orderId: order.id, status: order.status }
        });
      }
    }

    if (order.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Can only edit draft orders',
        message: 'Order has already been submitted'
      });
    }

    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    const updateData = {};
    if (meals) {
      const compositionErrors = validateMealsComposition(meals);
      if (compositionErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid meal selection',
          message: compositionErrors[0],
          details: compositionErrors
        });
      }
      updateData.meals = meals;
      const totals = await calculateOrderTotalsFromDB(meals);
      updateData.totalMeals = totals.totalMeals;
      updateData.subtotal = totals.subtotal;
      updateData.tax = totals.tax;
      updateData.total = totals.total;
    }

    if (billingEmail) updateData.billingEmail = billingEmail;
    if (billingName) updateData.billingName = billingName;
    if (notes !== undefined) updateData.notes = notes;

    await order.update(updateData);

    logger.info('Resident order updated', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: order,
      message: 'Order updated successfully'
    });
  } catch (error) {
    logger.error('Error updating resident order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: error.message
    });
  }
});

router.delete('/resident-orders/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await NursingHomeResidentOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (req.user.role === 'nursing_home_admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const oldValues = order.toJSON();
    const refundCount = await NursingHomeRefund.count({ where: { residentOrderId: id } });
    const hardDelete = (order.status === 'draft' || order.status === 'cancelled') && refundCount === 0;
    if (hardDelete) {
      await order.destroy();
    } else if (order.status !== 'cancelled') {
      await order.update({ status: 'cancelled' });
    }
    await logAdminAction(
      req.user.id,
      hardDelete ? 'DELETE' : 'UPDATE',
      'nh_resident_orders',
      id,
      oldValues,
      hardDelete ? null : order.toJSON(),
      req
    );

    logger.info('Nursing home resident order deleted', {
      orderId: id,
      hardDelete,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: hardDelete ? 'Order deleted successfully' : 'Order cancelled successfully'
    });
  } catch (error) {
    logger.error('Error deleting resident order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete order',
      message: error.message
    });
  }
});

router.get('/resident-orders/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [
        {
          model: NursingHomeResident,
          as: 'resident',
          attributes: ['id', 'name', 'roomNumber', 'facilityId', 'userId'],
          include: [
            {
              model: Profile,
              as: 'assignedUser',
              attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
            }
          ]
        },
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name', 'address'] },
        {
          model: Profile,
          as: 'createdBy',
          attributes: ['id', 'firstName', 'lastName', 'role']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!assertFacilityOrderAccess(req.user, order)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Error fetching resident order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order', message: error.message });
  }
});

router.post('/resident-orders/:id/submit', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{
        model: NursingHomeResident,
        as: 'resident'
      }]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (!assertFacilityOrderAccess(req.user, order)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const staffLock = nhUserStaffOrderConflict(order, req.user);
    if (staffLock) {
      return res.status(409).json({
        success: false,
        code: staffLock.code,
        error: staffLock.code,
        message: staffLock.message,
        data: { orderId: order.id, status: order.status }
      });
    }

    if (order.status === 'submitted' || order.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order already submitted'
      });
    }

    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot submit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM. Contact admin for assistance.'
      });
    }

    const oldValues = order.toJSON();
    const nextPaymentStatus =
      !order.paymentStatus || order.paymentStatus === 'pending'
        ? 'pending_monthly'
        : order.paymentStatus;
    await order.update({
      status: 'submitted',
      paymentStatus: nextPaymentStatus,
      submittedAt: new Date()
    });
    await createAdminNotification({
      type: 'nh.order.submitted',
      title: 'Nursing home: Resident order submitted',
      message: `Order ${order.orderNumber} (${order.residentName}) submitted for monthly billing`,
      ref: { kind: 'nh_resident_order', id: order.id, orderNumber: order.orderNumber, facilityId: order.facilityId }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_resident_orders', order.id, oldValues, order.toJSON(), req);

    logger.info('Resident order submitted without payment', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      submittedBy: req.user.id
    });

    res.json({
      success: true,
      data: order,
      message: 'Order submitted successfully'
    });
  } catch (error) {
    logger.error('Error submitting resident order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit order',
      message: error.message
    });
  }
});

router.post('/resident-orders/:id/submit-and-pay', paymentLimiter, requireNursingHomeUser, [
  body('paymentMethodId').optional().isString().trim(),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim(),
  body('billingPhone').optional().isString().trim()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethodId, billingEmail, billingName, billingPhone } = req.body;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{
        model: NursingHomeResident,
        as: 'resident'
      }]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (!assertFacilityOrderAccess(req.user, order)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const staffLockPay = nhUserStaffOrderConflict(order, req.user);
    if (staffLockPay) {
      return res.status(409).json({
        success: false,
        code: staffLockPay.code,
        error: staffLockPay.code,
        message: staffLockPay.message,
        data: { orderId: order.id, status: order.status }
      });
    }

    if (order.status === 'submitted' || order.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order already submitted'
      });
    }

    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot submit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM. Contact admin for assistance.'
      });
    }

    if (billingEmail || billingName || billingPhone !== undefined) {
      await order.update({
        ...(billingEmail && { billingEmail }),
        ...(billingName && { billingName }),
        ...(billingPhone !== undefined && { billingPhone })
      });
    }

    const receiptEmail = billingEmail || order.billingEmail;
    const billingNameVal = billingName || order.billingName || '';

    const stripeClient = stripe();
    if (!stripeClient) {
      return res.status(503).json({
        success: false,
        error: 'Payment not configured',
        message: 'STRIPE_SECRET_KEY is not set on the server.'
      });
    }

    let paymentIntent;
    try {
      paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(order.total * 100),
        currency: 'usd',
        payment_method: paymentMethodId || order.resident.paymentMethodId,
        confirm: true,
        automatic_payment_methods: paymentMethodId ? undefined : { enabled: true, allow_redirects: 'never' },
        description: `Weekly Meal Order - ${order.residentName} - Week of ${order.weekStartDate}`,
        metadata: {
          orderNumber: order.orderNumber,
          residentName: order.residentName,
          roomNumber: order.roomNumber || '',
          weekStartDate: order.weekStartDate,
          weekEndDate: order.weekEndDate,
          totalMeals: order.totalMeals.toString(),
          billingName: billingNameVal
        },
        receipt_email: receiptEmail,
        statement_descriptor: 'MKD MEALS'
      });

      const oldValues = order.toJSON();
      await order.update({
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'stripe',
        paymentIntentId: paymentIntent.id,
        paidAt: new Date(),
        submittedAt: new Date()
      });
      await createAdminNotification({
        type: 'nh.order.paid',
        title: 'Nursing home: Order paid',
        message: `Order ${order.orderNumber} (${order.residentName}) paid`,
        ref: { kind: 'nh_resident_order', id: order.id, orderNumber: order.orderNumber, facilityId: order.facilityId }
      });
      await logAdminAction(req.user.id, 'UPDATE', 'nh_resident_orders', order.id, oldValues, order.toJSON(), req);
      logger.info('Resident order paid', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentIntentId: paymentIntent.id,
        amount: order.total
      });

      res.json({
        success: true,
        data: order,
        message: 'Order submitted and payment processed successfully'
      });
    } catch (stripeError) {
      logger.error('Stripe payment failed:', stripeError);
      
      await order.update({
        paymentStatus: 'failed'
      });

      return res.status(402).json({
        success: false,
        error: 'Payment failed',
        message: stripeError.message
      });
    }
  } catch (error) {
    logger.error('Error submitting and paying for order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process order',
      message: error.message
    });
  }
});

router.get('/resident-orders/:id/export', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [
        {
          model: NursingHomeResident,
          as: 'resident'
        },
        {
          model: NursingHomeFacility,
          as: 'facility'
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user' || req.user.role === 'nursing_home_admin') {
      if (!assertFacilityOrderAccess(req.user, order)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MyKosherDelivery';
    const residentName = order.residentName || order.resident?.name || '';
    const roomNumber = order.roomNumber || order.resident?.roomNumber || 'N/A';
    const facilityName = order.facility?.name || '';
    const meals = Array.isArray(order.meals) ? order.meals : [];
    const mealFor = (day, mealType) => meals.find((m) => m.day === day && m.mealType === mealType) || null;

    const summary = workbook.addWorksheet('Order summary');
    summary.columns = [{ width: 22 }, { width: 52 }];
    summary.addRow(['Weekly meal order']);
    summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF061757' }, name: 'Calibri' };
    summary.addRow([]);
    const summaryRows = [
      ['Facility', facilityName || '—'],
      ['Resident', residentName || '—'],
      ['Room', roomNumber],
      ['Order number', order.orderNumber || ''],
      ['Week', formatNhExportWeek(order.weekStartDate, order.weekEndDate)],
      ['Status', formatNhExportEnum(order.status, NH_EXPORT_STATUS_LABELS)],
      ['Payment', formatNhExportEnum(order.paymentStatus, NH_EXPORT_PAYMENT_LABELS)],
      ['Meals ordered', order.totalMeals ?? meals.filter((m) => !isSkippedExportMeal(m)).length]
    ];
    summaryRows.forEach(([label, value]) => {
      const row = summary.addRow([label, value]);
      row.getCell(1).font = { bold: true, color: { argb: 'FF061757' } };
      row.alignment = { vertical: 'middle' };
    });
    summary.addRow([]);
    summary.addRow(['This sheet is a kitchen packing list. Item prices are billed on the monthly invoice.']);
    summary.getRow(summary.rowCount).font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };

    const weekly = workbook.addWorksheet('Weekly menu', { views: [{ state: 'frozen', ySplit: 1 }] });
    weekly.columns = [
      { width: 16 },
      { width: 38 },
      { width: 38 },
      { width: 38 }
    ];
    const weeklyHeader = weekly.addRow(['Day', 'Breakfast', 'Lunch', 'Dinner']);
    styleExportHeaderRow(weeklyHeader);
    NH_EXPORT_DAYS.forEach((day) => {
      const breakfast = formatMealExportCell(mealFor(day, 'breakfast'));
      const lunch = formatMealExportCell(mealFor(day, 'lunch'));
      const dinner = formatMealExportCell(mealFor(day, 'dinner'));
      if (breakfast === 'Skipped' && lunch === 'Skipped' && dinner === 'Skipped') return;
      const row = weekly.addRow([day, breakfast, lunch, dinner]);
      row.alignment = { vertical: 'top', wrapText: true };
      const lineCount = Math.max(
        String(breakfast).split('\n').length,
        String(lunch).split('\n').length,
        String(dinner).split('\n').length,
        2
      );
      row.height = Math.min(18 * lineCount + 8, 90);
      row.getCell(1).font = { bold: true, color: { argb: 'FF061757' } };
    });

    const itemized = workbook.addWorksheet('Itemized meals', { views: [{ state: 'frozen', ySplit: 1 }] });
    itemized.columns = [{ width: 16 }, { width: 14 }, { width: 42 }, { width: 18 }];
    styleExportHeaderRow(itemized.addRow(['Day', 'Meal', 'Item', 'Notes']));
    NH_EXPORT_DAYS.forEach((day) => {
      NH_EXPORT_MEALS.forEach((mealType) => {
        const meal = mealFor(day, mealType);
        if (!meal) return;
        const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
        if (isSkippedExportMeal(meal)) {
          const row = itemized.addRow([day, mealLabel, 'Skipped', '']);
          row.getCell(3).font = { italic: true, color: { argb: 'FF64748B' } };
          return;
        }
        (meal.items || [])
          .filter((i) => i && i.id !== 'none' && i.name !== 'None')
          .forEach((item) => {
            const notes = meal.bagelType && exportItemNeedsBagel(item) ? meal.bagelType : '';
            itemized.addRow([day, mealLabel, item.name, notes]);
          });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="meal-order-${order.orderNumber}.xlsx"`);
    res.send(Buffer.from(buffer));

    logger.info('Resident order exported', {
      orderId: order.id,
      exportedBy: req.user.id
    });
  } catch (error) {
    logger.error('Error exporting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export order',
      message: error.message
    });
  }
});

router.get('/resident-orders/:id/refunds', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{ model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name'] }]
    });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (req.user.role === 'nursing_home_admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const refunds = await NursingHomeRefund.findAll({
      where: { residentOrderId: id },
      include: [
        { model: Profile, as: 'processor', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: refunds });
  } catch (error) {
    logger.error('Error fetching resident order refunds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch refunds',
      message: error.message
    });
  }
});

router.post('/resident-orders/:id/refund', requireNursingHomeAdmin, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('reason').notEmpty().trim().withMessage('Refund reason is required'),
  body('refundType').isIn(['full', 'partial']).withMessage('Refund type must be full or partial')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { amount, reason, refundType } = req.body;
    const adminId = req.user.id;

    const order = await NursingHomeResidentOrder.findByPk(id, {
      include: [{ model: NursingHomeResident, as: 'resident' }]
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (req.user.role === 'nursing_home_admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const orderOldValues = order.toJSON();

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order not paid',
        message: 'Only paid orders can be refunded'
      });
    }

    const orderTotal = parseFloat(order.total || 0);
    const refundAmount = parseFloat(amount);

    const existingRefunds = await NursingHomeRefund.findAll({
      where: { residentOrderId: id, status: 'processed' }
    });
    const totalRefunded = existingRefunds.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const remainingRefundable = orderTotal - totalRefunded;

    if (refundType === 'full') {
      if (Math.abs(refundAmount - remainingRefundable) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'Invalid refund amount',
          message: `Full refund must match remaining refundable amount ($${remainingRefundable.toFixed(2)})`
        });
      }
    }
    if (refundAmount > remainingRefundable) {
      return res.status(400).json({
        success: false,
        error: 'Invalid refund amount',
        message: `Refund cannot exceed remaining refundable amount ($${remainingRefundable.toFixed(2)})`
      });
    }

    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId || !stripe) {
      return res.status(400).json({
        success: false,
        error: 'Cannot refund',
        message: paymentIntentId ? 'Stripe is not configured' : 'No Stripe payment found for this order'
      });
    }

    const refundRecord = await NursingHomeRefund.create({
      residentOrderId: id,
      amount: refundAmount,
      reason: reason.trim(),
      processedBy: adminId,
      status: 'pending'
    });

    const stripeClientRefund = stripe();
    if (!stripeClientRefund) {
      return res.status(503).json({
        success: false,
        error: 'Payment not configured',
        message: 'STRIPE_SECRET_KEY is not set on the server.'
      });
    }
    try {
      const stripeRefund = await stripeClientRefund.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: {
          residentOrderId: id,
          orderNumber: order.orderNumber,
          refundId: refundRecord.id
        }
      });

      await refundRecord.update({
        stripeRefundId: stripeRefund.id,
        status: 'processed'
      });

      const isFullRefund = refundType === 'full' || Math.abs(refundAmount - remainingRefundable) < 0.01;
      if (isFullRefund) {
        await order.update({ paymentStatus: 'refunded' });
      }

      await createAdminNotification({
        type: 'nh.order.refunded',
        title: 'Nursing home: Order refunded',
        message: `Order ${order.orderNumber} refunded $${refundAmount.toFixed(2)} (${refundType})`,
        ref: { kind: 'nh_resident_order', id: order.id, orderNumber: order.orderNumber, refundId: refundRecord.id }
      });
      await logAdminAction(adminId, 'UPDATE', 'nh_resident_orders', order.id, orderOldValues, order.toJSON(), req);
      logger.info('Nursing home resident order refund processed', {
        refundId: refundRecord.id,
        residentOrderId: id,
        orderNumber: order.orderNumber,
        amount: refundAmount,
        adminId
      });

      res.json({
        success: true,
        data: {
          refund: refundRecord.toJSON(),
          stripeRefundId: stripeRefund.id
        },
        message: 'Refund processed successfully'
      });
    } catch (stripeError) {
      await refundRecord.update({ status: 'failed' });
      logger.error('Stripe refund failed for resident order:', stripeError, {
        residentOrderId: id,
        refundId: refundRecord.id
      });
      res.status(500).json({
        success: false,
        error: 'Refund failed',
        message: stripeError.message || 'Failed to process refund through Stripe'
      });
    }
  } catch (error) {
    logger.error('Error processing resident order refund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process refund',
      message: error.message
    });
  }
});

router.get('/orders', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, facilityId, weekStartDate } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    if (req.user.role === 'admin') {
      if (facilityId) {
        where.facilityId = facilityId;
      }
    } else if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    } else if (req.user.role === 'nursing_home_user') {
      where.facilityId = req.user.nursingHomeFacilityId;
      where.createdByUserId = req.user.id;
    }

    if (status) {
      where.status = status;
    }
    if (weekStartDate) {
      where.weekStartDate = weekStartDate;
    }

    const { count, rows: orders } = await NursingHomeOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address']
        },
        {
          model: Profile,
          as: 'createdBy',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching nursing home orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

router.get('/orders/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeOrder.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address', 'contactEmail', 'contactPhone']
        },
        {
          model: Profile,
          as: 'createdBy',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
      message: error.message
    });
  }
});

router.post('/orders', requireNursingHomeUser, validateBulkOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { facilityId, weekStartDate, weekEndDate, residentMeals, deliveryAddress } = req.body;

    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    const deadline = calculateDeadline(weekStartDate);
    const totals = calculateBulkOrderTotals(residentMeals);
    const orderNumber = generateBulkOrderNumber();

    const order = await NursingHomeOrder.create({
      facilityId,
      createdByUserId: req.user.id,
      orderNumber,
      weekStartDate,
      weekEndDate,
      residentMeals,
      status: 'draft',
      totalMeals: totals.totalMeals,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      deliveryAddress,
      deadline
    });

    logger.info('Nursing home order created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      facilityId,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

router.put('/orders/:id', requireNursingHomeUser, [
  body('residentMeals').optional().isArray(),
  body('deliveryAddress').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const order = await NursingHomeOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const now = new Date();
    if (now > order.deadline && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    if (order.status === 'submitted' && req.user.role !== 'admin' && req.user.role !== 'nursing_home_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit submitted order'
      });
    }

    if (updateData.residentMeals) {
      const totals = calculateBulkOrderTotals(updateData.residentMeals);
      updateData.totalMeals = totals.totalMeals;
      updateData.subtotal = totals.subtotal;
      updateData.tax = totals.tax;
      updateData.total = totals.total;
    }

    await order.update(updateData);

    logger.info('Nursing home order updated', {
      orderId: order.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: error.message
    });
  }
});

router.post('/orders/:id/submit', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (order.status === 'submitted') {
      return res.status(400).json({
        success: false,
        error: 'Order already submitted'
      });
    }

    const now = new Date();
    if (now > order.deadline) {
      return res.status(403).json({
        success: false,
        error: 'Cannot submit order after deadline',
        message: 'Orders must be submitted by Sunday 12:00 PM'
      });
    }

    const oldValues = order.toJSON();
    await order.update({
      status: 'submitted',
      submittedAt: new Date()
    });
    await createAdminNotification({
      type: 'nh.order.submitted',
      title: 'Nursing home: Weekly order submitted',
      message: `Order ${order.orderNumber} submitted for facility`,
      ref: { kind: 'nh_order', id: order.id, orderNumber: order.orderNumber, facilityId: order.facilityId }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_orders', order.id, oldValues, order.toJSON(), req);
    logger.info('Nursing home order submitted', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      submittedBy: req.user.id
    });

    res.json({
      success: true,
      data: order,
      message: 'Order submitted successfully'
    });
  } catch (error) {
    logger.error('Error submitting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit order',
      message: error.message
    });
  }
});

router.delete('/orders/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await NursingHomeOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role !== 'admin' && order.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const oldValues = order.toJSON();
    await order.update({ status: 'cancelled' });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_orders', order.id, oldValues, order.toJSON(), req);

    logger.info('Nursing home order cancelled', {
      orderId: order.id,
      cancelledBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
      message: error.message
    });
  }
});

router.get('/orders/:id/export', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { residentId } = req.query;

    const order = await NursingHomeOrder.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (order.createdByUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (order.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    let mealsToExport = order.residentMeals;
    if (residentId) {
      mealsToExport = order.residentMeals.filter(rm => rm.residentId === residentId);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheetData = [];

    worksheetData.push(['Nursing Home Meal Order']);
    worksheetData.push(['Facility:', order.facility.name]);
    worksheetData.push(['Order Number:', order.orderNumber]);
    worksheetData.push(['Week:', `${order.weekStartDate} to ${order.weekEndDate}`]);
    worksheetData.push([]);
    worksheetData.push(['Resident', 'Room', 'Day', 'Meal Type', 'Main/Entree', 'Side/Soup', 'Dessert', 'Bagel Type', 'Special Notes']);

    mealsToExport.forEach(resident => {
      resident.meals.forEach(meal => {
        const mainItem = meal.items.find(i => ['main', 'entree'].includes(i.category));
        const sideItems = meal.items.filter(i => ['side', 'soup'].includes(i.category));
        const dessertItem = meal.items.find(i => i.category === 'dessert');

        worksheetData.push([
          resident.residentName,
          resident.roomNumber || '',
          meal.day,
          meal.mealType,
          mainItem?.name || '',
          sideItems.map(s => s.name).join(', '),
          dessertItem?.name || '',
          meal.bagelType || '',
          ''
        ]);
      });
    });

    const worksheet = workbook.addWorksheet('Meal Orders');
    worksheetData.forEach(row => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="nursing-home-order-${order.orderNumber}.xlsx"`);
    res.send(Buffer.from(buffer));

    logger.info('Nursing home order exported', {
      orderId: order.id,
      exportedBy: req.user.id,
      residentId: residentId || 'all'
    });
  } catch (error) {
    logger.error('Error exporting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export order',
      message: error.message
    });
  }
});

module.exports = router;

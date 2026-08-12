const express = require('express');
const { query } = require('express-validator');
const {
  sequelize,
  NursingHomeFacility,
  NursingHomeResident,
  NursingHomeResidentOrder,
  NursingHomeMenuItem,
  NursingHomeInvoice,
  NursingHomeOrder,
  NursingHomeRefund,
  Profile
} = require('../models');
const { QueryTypes, Op } = require('sequelize');
const { requireAdmin, requireNursingHomeAdmin, requireNursingHomeUser } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { createAdminNotification } = require('../utils/adminNotifications');
const { logAdminAction } = require('../utils/auditLog');
const {
  ensureResidentForNhUserProfile,
  syncFacilityResidentLogins,
  syncAllOrphanNhUserResidents
} = require('../utils/nhResidentLoginSync');

const router = express.Router();

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

function slugifyFacilityName(name) {
  if (!name || typeof name !== 'string') return 'facility';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'facility';
}

async function ensureUniqueFacilitySlug(baseSlug, excludeId = null) {
  let slug = baseSlug || 'facility';
  let suffix = 2;
  for (;;) {
    const where = { slug };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await NursingHomeFacility.findOne({ where, attributes: ['id'] });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

const menuQueryValidation = [
  query('mealType').optional().isIn(['breakfast', 'lunch', 'dinner']),
  query('category').optional().isIn(['main', 'side', 'entree', 'dessert', 'soup']),
  query('isActive').optional().isIn(['true', 'false'])
];

router.get('/facilities', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', isActive } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitNum = parseInt(limit, 10) || 20;

    const where = {};
    if (search) {
      where.name = { [require('sequelize').Op.iLike]: `%${search}%` };
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const result = await NursingHomeFacility.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['name', 'ASC']]
    });
    const count = result.count;
    const facilities = result.rows;

    const totalPages = limitNum > 0 ? Math.ceil(count / limitNum) : 0;
    res.json({
      success: true,
      data: facilities,
      pagination: {
        total: count,
        page: parseInt(page, 10) || 1,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    logger.error('Error fetching nursing home facilities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch facilities',
      message: error.message
    });
  }
});

const NOT_ASSIGNED_MESSAGE =
  'You are not assigned to a facility yet. Contact your administrator.';

const sendNotAssigned = (res) =>
  res.status(403).json({
    success: false,
    code: 'NOT_ASSIGNED',
    error: 'NOT_ASSIGNED',
    message: NOT_ASSIGNED_MESSAGE
  });

router.get('/facilities/current', requireNursingHomeUser, async (req, res) => {
  try {
    const { facilityId: queryFacilityId } = req.query;
    let facility = null;

    if (req.user.role === 'admin') {
      if (queryFacilityId) {
        facility = await NursingHomeFacility.findByPk(queryFacilityId);
        if (facility && facility.isActive === false) {
          facility = null;
        }
      } else {
        facility = await NursingHomeFacility.findOne({
          where: { isActive: true },
          order: [['name', 'ASC']]
        });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (req.user.nursingHomeFacilityId) {
        facility = await NursingHomeFacility.findByPk(req.user.nursingHomeFacilityId);
      }
    } else if (req.user.role === 'nursing_home_user') {
      if (req.user.nursingHomeFacilityId) {
        facility = await NursingHomeFacility.findByPk(req.user.nursingHomeFacilityId);
      }
      if (!facility) {
        const resident = await NursingHomeResident.findOne({
          where: { assignedUserId: req.user.id, isActive: true },
          include: [{ model: NursingHomeFacility, as: 'facility' }]
        });
        facility = resident?.facility || null;
      }
    }

    if (facility && facility.isActive === false) {
      facility = null;
    }

    if (!facility) {
      return sendNotAssigned(res);
    }

    res.json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error fetching current facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch facility',
      message: error.message
    });
  }
});

router.get('/facilities/by-slug/:slug', requireNursingHomeUser, async (req, res) => {
  try {
    const { slug } = req.params;
    const facility = await NursingHomeFacility.findOne({ where: { slug } });

    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found',
        message: 'Facility not found'
      });
    }

    if (!facility.isActive) {
      return res.status(403).json({
        success: false,
        code: 'FACILITY_INACTIVE',
        error: 'FACILITY_INACTIVE',
        message: 'This facility is inactive. Contact your administrator.'
      });
    }

    if (req.user.role !== 'admin') {
      if (
        (req.user.role === 'nursing_home_admin' || req.user.role === 'nursing_home_user') &&
        req.user.nursingHomeFacilityId !== facility.id
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error fetching facility by slug:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch facility',
      message: error.message
    });
  }
});

router.get('/facilities/:id/staff', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id: facilityId } = req.params;
    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    let staff = [];
    try {
      const rows = await sequelize.query(
        `SELECT id, email, first_name AS "firstName", last_name AS "lastName", role, phone, created_at AS "createdAt"
         FROM profiles
         WHERE nursing_home_facility_id = :facilityId
           AND role = 'nursing_home_admin'
         ORDER BY last_name, first_name`,
        { replacements: { facilityId }, type: QueryTypes.SELECT }
      );
      staff = rows || [];
    } catch (dbErr) {
      const msg = (dbErr.message || '') + (dbErr.original?.message || '');
      if (/nursing_home_facility_id|column.*does not exist/i.test(msg)) {
        logger.debug('profiles.nursing_home_facility_id not present, returning empty staff');
      } else {
        throw dbErr;
      }
    }
    res.json({ success: true, data: staff });
  } catch (error) {
    logger.error('Error fetching facility staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff',
      message: error.message
    });
  }
});

router.get('/facilities/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await sequelize.query(
      `SELECT id, name, slug, address, contact_email AS "contactEmail", contact_phone AS "contactPhone",
              logo_url AS "logoUrl", billing_frequency AS "billingFrequency", is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM nursing_home_facilities WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    const facility = rows && rows[0] ? rows[0] : null;

    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facility.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    let staff = [];
    try {
      const staffRows = await sequelize.query(
        `SELECT id, email, first_name AS "firstName", last_name AS "lastName", role, phone, created_at AS "createdAt"
         FROM profiles
         WHERE nursing_home_facility_id = :facilityId
         ORDER BY last_name, first_name`,
        { replacements: { facilityId: id }, type: QueryTypes.SELECT }
      );
      staff = staffRows || [];
    } catch (dbErr) {
      const msg = (dbErr.message || '') + (dbErr.original?.message || '');
      if (!/nursing_home_facility_id|column.*does not exist/i.test(msg)) {
        throw dbErr;
      }
    }

    facility.staff = staff;
    res.json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error fetching facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch facility',
      message: error.message
    });
  }
});

router.post('/facilities', requireAdmin, [
  body('name').notEmpty().trim(),
  body('address').isObject(),
  body('address.street').notEmpty(),
  body('address.city').notEmpty(),
  body('address.state').notEmpty(),
  body('address.zip_code').notEmpty(),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional(),
  body('billingFrequency').optional().isIn(['weekly', 'monthly']),
  body('logoUrl').optional().isURL()
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

    const { name, address, contactEmail, contactPhone, billingFrequency, logoUrl, slug: providedSlug } = req.body;

    const baseSlug = providedSlug ? slugifyFacilityName(providedSlug) : slugifyFacilityName(name);
    const slug = await ensureUniqueFacilitySlug(baseSlug);

    const facility = await NursingHomeFacility.create({
      name,
      slug,
      address,
      contactEmail,
      contactPhone,
      billingFrequency: billingFrequency || 'monthly',
      logoUrl: logoUrl || null,
      isActive: true
    });
    await createAdminNotification({
      type: 'nh.facility.created',
      title: 'Nursing home: Facility added',
      message: `"${facility.name}" was created`,
      ref: { kind: 'nh_facility', id: facility.id, name: facility.name }
    });
    await logAdminAction(req.user.id, 'CREATE', 'nh_facilities', facility.id, null, facility.toJSON(), req);
    logger.info('Nursing home facility created', {
      facilityId: facility.id,
      name: facility.name,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error creating facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create facility',
      message: error.message
    });
  }
});

router.put('/facilities/:id', requireAdmin, [
  body('name').optional().notEmpty().trim(),
  body('address').optional().isObject(),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional(),
  body('billingFrequency').optional().isIn(['weekly', 'monthly']),
  body('isActive').optional().isBoolean(),
  body('logoUrl').optional().isURL()
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
    const updateData = { ...req.body };
    if (updateData.logoUrl === '') updateData.logoUrl = null;

    const facility = await NursingHomeFacility.findByPk(id);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    if (updateData.slug) {
      updateData.slug = await ensureUniqueFacilitySlug(slugifyFacilityName(updateData.slug), id);
    } else if (updateData.name && !req.body.slug) {
      updateData.slug = await ensureUniqueFacilitySlug(slugifyFacilityName(updateData.name), id);
    }

    const facilityOldValues = facility.toJSON();
    await facility.update(updateData);
    await createAdminNotification({
      type: 'nh.facility.updated',
      title: 'Nursing home: Facility updated',
      message: `"${facility.name}" was updated`,
      ref: { kind: 'nh_facility', id: facility.id, name: facility.name }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_facilities', facility.id, facilityOldValues, facility.toJSON(), req);
    logger.info('Nursing home facility updated', {
      facilityId: facility.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: facility
    });
  } catch (error) {
    logger.error('Error updating facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update facility',
      message: error.message
    });
  }
});

router.delete('/facilities/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const facility = await NursingHomeFacility.findByPk(id);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    const facilityName = facility.name;
    const facilityOldValues = facility.toJSON();
    await facility.update({ isActive: false });
    await createAdminNotification({
      type: 'nh.facility.deactivated',
      title: 'Nursing home: Facility deactivated',
      message: `"${facilityName}" was deactivated`,
      ref: { kind: 'nh_facility', id: facility.id, name: facilityName }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_facilities', facility.id, facilityOldValues, facility.toJSON(), req);
    logger.info('Nursing home facility deactivated', {
      facilityId: facility.id,
      deactivatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Facility deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating facility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate facility',
      message: error.message
    });
  }
});

function requireFacilityStaffAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'nursing_home_admin' && req.user.nursingHomeFacilityId === req.params.facilityId) return next();
  return res.status(403).json({ success: false, error: 'Access denied' });
}

function requirePlatformAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({
    success: false,
    error: 'Access denied',
    message: 'Only platform admins can manage nursing home staff accounts'
  });
}

router.post('/facilities/:facilityId/staff', requireNursingHomeAdmin, requirePlatformAdmin, requireFacilityStaffAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters'),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('role').optional().isIn(['nursing_home_admin']),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { facilityId } = req.params;
    const { email, password, firstName, lastName, phone } = req.body;

    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }

    const existing = await Profile.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    const user = await Profile.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      role: 'nursing_home_admin',
      nursingHomeFacilityId: facilityId
    });
    await createAdminNotification({
      type: 'nh.staff.created',
      title: 'Nursing home: Staff added',
      message: `"${firstName} ${lastName}" (${email}) added to facility`,
      ref: { kind: 'nh_staff', id: user.id, facilityId, name: `${firstName} ${lastName}` }
    });
    const out = user.toJSON();
    delete out.password;
    await logAdminAction(req.user.id, 'CREATE', 'nh_staff', user.id, null, out, req);
    logger.info('Nursing home staff created', { userId: user.id, facilityId, createdBy: req.user.id });

    res.status(201).json({ success: true, data: out });
  } catch (error) {
    logger.error('Error creating nursing home staff:', error);
    res.status(500).json({ success: false, error: 'Failed to create staff', message: error.message });
  }
});

router.put('/facilities/:facilityId/staff/:userId', requireNursingHomeAdmin, requirePlatformAdmin, requireFacilityStaffAdmin, [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('role').optional().isIn(['nursing_home_admin']),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { facilityId, userId } = req.params;
    const updateData = { ...req.body };
    updateData.role = 'nursing_home_admin';

    const user = await Profile.findByPk(userId);
    if (!user || user.nursingHomeFacilityId !== facilityId || user.role !== 'nursing_home_admin') {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const userOldValues = user.toJSON();
    delete userOldValues.password;
    await user.update(updateData);
    await createAdminNotification({
      type: 'nh.staff.updated',
      title: 'Nursing home: Staff updated',
      message: `Staff member at facility was updated`,
      ref: { kind: 'nh_staff', id: userId, facilityId }
    });
    const userNewOut = user.toJSON();
    delete userNewOut.password;
    await logAdminAction(req.user.id, 'UPDATE', 'nh_staff', userId, userOldValues, userNewOut, req);
    logger.info('Nursing home staff updated', { userId, facilityId, updatedBy: req.user.id });
    const out = user.toJSON();
    delete out.password;
    res.json({ success: true, data: out });
  } catch (error) {
    logger.error('Error updating nursing home staff:', error);
    res.status(500).json({ success: false, error: 'Failed to update staff', message: error.message });
  }
});

router.delete('/facilities/:facilityId/staff/:userId', requireNursingHomeAdmin, requirePlatformAdmin, requireFacilityStaffAdmin, async (req, res) => {
  try {
    const { facilityId, userId } = req.params;
    const user = await Profile.findByPk(userId);
    if (!user || user.nursingHomeFacilityId !== facilityId || user.role !== 'nursing_home_admin') {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot remove an admin from facility this way' });
    }
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const userOldValues = user.toJSON();
    delete userOldValues.password;
    await NursingHomeResident.update(
      { assignedUserId: null },
      { where: { assignedUserId: userId } }
    );
    await user.update({ nursingHomeFacilityId: null, role: 'user' });
    await createAdminNotification({
      type: 'nh.staff.removed',
      title: 'Nursing home: Staff removed',
      message: `"${userName}" removed from facility`,
      ref: { kind: 'nh_staff', id: userId, facilityId }
    });
    const userNewOut = user.toJSON();
    delete userNewOut.password;
    await logAdminAction(req.user.id, 'UPDATE', 'nh_staff', userId, userOldValues, userNewOut, req);
    logger.info('Staff removed from facility', { userId, facilityId, removedBy: req.user.id });
    res.json({ success: true, message: 'Staff removed from facility' });
  } catch (error) {
    logger.error('Error removing staff:', error);
    res.status(500).json({ success: false, error: 'Failed to remove staff', message: error.message });
  }
});

router.post('/facilities/:facilityId/staff/bulk', requireNursingHomeAdmin, requirePlatformAdmin, requireFacilityStaffAdmin, [
  body('staff').isArray(),
  body('staff.*.email').isEmail().normalizeEmail(),
  body('staff.*.firstName').notEmpty().trim(),
  body('staff.*.lastName').notEmpty().trim(),
  body('staff.*.role').optional().isIn(['nursing_home_admin']),
  body('staff.*.password').optional().isLength({ min: 8, max: 128 }),
  body('staff.*.phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { facilityId } = req.params;
    const { staff: staffList } = req.body;

    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }

    const bcrypt = require('bcryptjs');
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const results = { created: [], skipped: [], errors: [] };
    const defaultPassword = process.env.NURSING_HOME_DEFAULT_STAFF_PASSWORD;
    if (!defaultPassword) {
      const missingPassword = staffList.some((row) => !row.password);
      if (missingPassword) {
        return res.status(400).json({
          success: false,
          error: 'NURSING_HOME_DEFAULT_STAFF_PASSWORD is not configured',
          message: 'Set NURSING_HOME_DEFAULT_STAFF_PASSWORD or provide a password for each staff row'
        });
      }
    }

    for (const row of staffList) {
      try {
        const existing = await Profile.findOne({ where: { email: row.email } });
        if (existing) {
          results.skipped.push({ email: row.email, reason: 'Email already exists' });
          continue;
        }
        const password = row.password || defaultPassword;
        if (!password) {
          results.errors.push({ email: row.email, message: 'Password required' });
          continue;
        }
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const user = await Profile.create({
          email: row.email,
          password: hashedPassword,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone || null,
          role: 'nursing_home_admin',
          nursingHomeFacilityId: facilityId
        });
        results.created.push({ id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` });
      } catch (err) {
        results.errors.push({ email: row.email, message: err.message });
      }
    }
    if (results.created.length > 0) {
      await createAdminNotification({
        type: 'nh.staff.bulk',
        title: 'Nursing home: Staff bulk add',
        message: `${results.created.length} staff added to facility`,
        ref: { kind: 'nh_staff', facilityId, count: results.created.length }
      });
      await logAdminAction(req.user.id, 'CREATE', 'nh_staff_bulk', facilityId, null, { created: results.created.length, skipped: results.skipped.length, errors: results.errors.length }, req);
    }
    res.status(201).json({ success: true, data: results });
  } catch (error) {
    logger.error('Error bulk creating staff:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk create staff', message: error.message });
  }
});

router.get('/residents', requireNursingHomeUser, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', facilityId, assignedUserId, isActive } = req.query;
    const offset = (page - 1) * limit;

    // Link orphan nursing_home_user logins (e.g. created via Admin Users) to resident rows
    try {
      if (req.user.role === 'admin') {
        if (facilityId) await syncFacilityResidentLogins(facilityId);
        else await syncAllOrphanNhUserResidents();
      } else if (req.user.role === 'nursing_home_admin' && req.user.nursingHomeFacilityId) {
        await syncFacilityResidentLogins(req.user.nursingHomeFacilityId);
      } else if (req.user.role === 'nursing_home_user') {
        await ensureResidentForNhUserProfile(req.user);
      }
    } catch (syncErr) {
      logger.warn('NH resident login sync skipped:', syncErr.message);
    }

    const where = {};

    if (req.user.role === 'nursing_home_user') {
      where.userId = req.user.id;
    } else if (req.user.role === 'admin') {
      if (facilityId) {
        where.facilityId = facilityId;
      }
    } else if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    }

    if (assignedUserId === 'me' && req.user.role === 'nursing_home_admin') {
      where.assignedUserId = req.user.id;
    } else if (assignedUserId && ['admin', 'nursing_home_admin'].includes(req.user.role)) {
      where.assignedUserId = assignedUserId === 'me' ? req.user.id : assignedUserId;
    }

    if (search) {
      where.name = { [require('sequelize').Op.iLike]: `%${search}%` };
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const { count, rows: residents } = await NursingHomeResident.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']],
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name']
        },
        {
          model: Profile,
          as: 'assignedUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Profile,
          as: 'userAccount',
          attributes: ['id', 'email', 'firstName', 'lastName', 'role']
        }
      ]
    });

    res.json({
      success: true,
      data: residents,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
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

router.get('/residents/me', requireNursingHomeUser, async (req, res) => {
  try {
    if (req.user.role !== 'nursing_home_user') {
      return res.status(400).json({
        success: false,
        error: 'Not a resident login',
        message: 'This endpoint is only for nursing home resident accounts'
      });
    }

    const resident = await NursingHomeResident.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'slug', 'address']
        },
        {
          model: Profile,
          as: 'assignedUser',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        },
        {
          model: Profile,
          as: 'userAccount',
          attributes: ['id', 'email', 'firstName', 'lastName', 'role']
        }
      ]
    });

    if (!resident) {
      try {
        await ensureResidentForNhUserProfile(req.user);
      } catch (syncErr) {
        logger.warn('Failed to auto-link resident for /residents/me:', syncErr.message);
      }
      const linked = await NursingHomeResident.findOne({
        where: { userId: req.user.id },
        include: [
          {
            model: NursingHomeFacility,
            as: 'facility',
            attributes: ['id', 'name', 'slug', 'address']
          },
          {
            model: Profile,
            as: 'assignedUser',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
          },
          {
            model: Profile,
            as: 'userAccount',
            attributes: ['id', 'email', 'firstName', 'lastName', 'role']
          }
        ]
      });
      if (!linked) {
        return res.status(404).json({
          success: false,
          code: 'NO_RESIDENT_PROFILE',
          error: 'NO_RESIDENT_PROFILE',
          message: 'No resident profile is linked to this account. Contact your facility administrator.'
        });
      }
      if (!linked.isActive) {
        return res.status(403).json({
          success: false,
          code: 'RESIDENT_INACTIVE',
          error: 'RESIDENT_INACTIVE',
          message: 'Your resident profile is inactive. Contact your facility administrator.'
        });
      }
      return res.json({ success: true, data: linked });
    }

    if (!resident.isActive) {
      return res.status(403).json({
        success: false,
        code: 'RESIDENT_INACTIVE',
        error: 'RESIDENT_INACTIVE',
        message: 'Your resident profile is inactive. Contact your facility administrator.'
      });
    }

    res.json({ success: true, data: resident });
  } catch (error) {
    logger.error('Error fetching own resident profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resident',
      message: error.message
    });
  }
});

router.get('/residents/:id', requireNursingHomeUser, async (req, res) => {
  try {
    const { id } = req.params;

    const resident = await NursingHomeResident.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address']
        },
        {
          model: Profile,
          as: 'assignedUser',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        },
        {
          model: Profile,
          as: 'userAccount',
          attributes: ['id', 'email', 'firstName', 'lastName', 'role']
        }
      ]
    });

    if (!resident) {
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role === 'nursing_home_user') {
      if (resident.userId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else if (req.user.role === 'nursing_home_admin') {
      if (resident.facilityId !== req.user.nursingHomeFacilityId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({
      success: true,
      data: resident
    });
  } catch (error) {
    logger.error('Error fetching resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resident',
      message: error.message
    });
  }
});

router.post('/residents', requireNursingHomeAdmin, [
  body('facilityId').isUUID(),
  body('name').notEmpty().trim(),
  body('roomNumber').notEmpty().trim(),
  body('dietaryRestrictions').optional().trim(),
  body('allergies').optional().trim(),
  body('notes').optional().trim(),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('billingPhone').optional().isString().trim(),
  body('assignedUserId').optional().isUUID(),
  body('createLogin').optional().isBoolean(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 8, max: 128 }),
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 })
], async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      facilityId,
      name,
      roomNumber,
      dietaryRestrictions,
      allergies,
      notes,
      billingEmail,
      billingName,
      billingPhone,
      assignedUserId,
      createLogin,
      email,
      password,
      firstName,
      lastName
    } = req.body;

    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facilityId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const facility = await NursingHomeFacility.findByPk(facilityId, { transaction });
    if (!facility) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    if (assignedUserId) {
      const assignedUser = await Profile.findByPk(assignedUserId, { transaction });
      if (
        !assignedUser ||
        assignedUser.nursingHomeFacilityId !== facilityId ||
        assignedUser.role !== 'nursing_home_admin'
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Invalid assigned staff',
          message: 'Assigned staff must be a nursing home staff account for this facility'
        });
      }
    }

    const wantsLogin = createLogin === true || createLogin === 'true' || Boolean(email && password);
    let userAccount = null;

    if (wantsLogin) {
      if (!email || !password) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Login credentials required',
          message: 'Email and password are required to create a resident login'
        });
      }

      const existing = await Profile.findOne({ where: { email }, transaction });
      if (existing) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Email already in use',
          message: 'An account with this email already exists'
        });
      }

      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
      const nameParts = String(name || '').trim().split(/\s+/);
      const resolvedFirst = (firstName && String(firstName).trim()) || nameParts[0] || 'Resident';
      const resolvedLast = (lastName && String(lastName).trim()) || nameParts.slice(1).join(' ') || 'Resident';

      userAccount = await Profile.create({
        email,
        password: hashedPassword,
        firstName: resolvedFirst,
        lastName: resolvedLast,
        role: 'nursing_home_user',
        nursingHomeFacilityId: facilityId,
        isActive: true
      }, { transaction });
    }

    const resident = await NursingHomeResident.create({
      facilityId,
      name,
      roomNumber,
      dietaryRestrictions,
      allergies,
      notes,
      billingEmail: billingEmail || email || null,
      billingName: billingName || null,
      billingPhone: billingPhone || null,
      assignedUserId: assignedUserId || null,
      userId: userAccount ? userAccount.id : null,
      isActive: true
    }, { transaction });

    await transaction.commit();

    const full = await NursingHomeResident.findByPk(resident.id, {
      include: [
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name'] },
        { model: Profile, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Profile, as: 'userAccount', attributes: ['id', 'email', 'firstName', 'lastName', 'role'] }
      ]
    });

    await createAdminNotification({
      type: 'nh.resident.created',
      title: 'Nursing home: Resident added',
      message: `"${name}" (${roomNumber}) added${userAccount ? ' with login' : ''}`,
      ref: { kind: 'nh_resident', id: resident.id, facilityId, name }
    });
    await logAdminAction(req.user.id, 'CREATE', 'nh_residents', resident.id, null, full.toJSON(), req);
    logger.info('Resident created', {
      residentId: resident.id,
      facilityId,
      hasLogin: Boolean(userAccount),
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: full
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create resident',
      message: error.message
    });
  }
});

router.put('/residents/:id', requireNursingHomeAdmin, [
  body('name').optional().notEmpty().trim(),
  body('roomNumber').optional().trim(),
  body('dietaryRestrictions').optional().trim(),
  body('allergies').optional().trim(),
  body('notes').optional().trim(),
  body('billingEmail').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('billingName').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('billingPhone').optional({ nullable: true }).isString().trim(),
  body('assignedUserId').optional({ nullable: true }).custom((val) => {
    if (val === null || val === '' || val === undefined) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val));
  }),
  body('isActive').optional().isBoolean(),
  body('createLogin').optional().isBoolean(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 8, max: 128 }),
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 })
], async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const {
      createLogin,
      email,
      password,
      firstName,
      lastName,
      ...rest
    } = req.body;
    const updateData = { ...rest };
    delete updateData.userId;
    delete updateData.role;
    if (Object.prototype.hasOwnProperty.call(updateData, 'assignedUserId') && updateData.assignedUserId === '') {
      updateData.assignedUserId = null;
    }

    const resident = await NursingHomeResident.findByPk(id, { transaction });
    if (!resident) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role !== 'admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (updateData.assignedUserId) {
      const assignedUser = await Profile.findByPk(updateData.assignedUserId, { transaction });
      if (
        !assignedUser ||
        assignedUser.nursingHomeFacilityId !== resident.facilityId ||
        assignedUser.role !== 'nursing_home_admin'
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Invalid assigned staff',
          message: 'Assigned staff must be a nursing home staff account for this facility'
        });
      }
    }

    const residentOldValues = resident.toJSON();
    const wantsLogin = createLogin === true || createLogin === 'true' || Boolean(email && password && !resident.userId);

    if (wantsLogin) {
      if (resident.userId) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Login already exists',
          message: 'This resident already has a login account'
        });
      }
      if (!email || !password) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Login credentials required',
          message: 'Email and password are required to create a resident login'
        });
      }
      const existing = await Profile.findOne({ where: { email }, transaction });
      if (existing) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Email already in use',
          message: 'An account with this email already exists'
        });
      }
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
      const nameParts = String(updateData.name || resident.name || '').trim().split(/\s+/);
      const resolvedFirst = (firstName && String(firstName).trim()) || nameParts[0] || 'Resident';
      const resolvedLast = (lastName && String(lastName).trim()) || nameParts.slice(1).join(' ') || 'Resident';
      const userAccount = await Profile.create({
        email,
        password: hashedPassword,
        firstName: resolvedFirst,
        lastName: resolvedLast,
        role: 'nursing_home_user',
        nursingHomeFacilityId: resident.facilityId,
        isActive: true
      }, { transaction });
      updateData.userId = userAccount.id;
      if (!updateData.billingEmail && !resident.billingEmail) {
        updateData.billingEmail = email;
      }
    } else if (resident.userId && password && String(password).length >= 8) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
      await Profile.update(
        { password: hashedPassword },
        { where: { id: resident.userId, role: 'nursing_home_user' }, transaction }
      );
    }

    await resident.update(updateData, { transaction });
    await transaction.commit();

    const full = await NursingHomeResident.findByPk(resident.id, {
      include: [
        { model: NursingHomeFacility, as: 'facility', attributes: ['id', 'name'] },
        { model: Profile, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Profile, as: 'userAccount', attributes: ['id', 'email', 'firstName', 'lastName', 'role'] }
      ]
    });

    await createAdminNotification({
      type: 'nh.resident.updated',
      title: 'Nursing home: Resident updated',
      message: `Resident "${full.name}" was updated`,
      ref: { kind: 'nh_resident', id: full.id, facilityId: full.facilityId }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_residents', full.id, residentOldValues, full.toJSON(), req);
    logger.info('Resident updated', {
      residentId: full.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: full
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error updating resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resident',
      message: error.message
    });
  }
});

router.post('/residents/:id/assign', requireNursingHomeAdmin, [
  body('assignedUserId').isUUID()
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
    const { assignedUserId } = req.body;

    const resident = await NursingHomeResident.findByPk(id);
    if (!resident) {
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role !== 'admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const assignedUser = await Profile.findByPk(assignedUserId);
    if (
      !assignedUser ||
      assignedUser.nursingHomeFacilityId !== resident.facilityId ||
      assignedUser.role !== 'nursing_home_admin'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assigned staff',
        message: 'Assigned staff must be a nursing home staff account for this facility'
      });
    }

    const residentOldValues = resident.toJSON();
    await resident.update({ assignedUserId });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_residents', resident.id, residentOldValues, resident.toJSON(), req);

    logger.info('Resident assigned', {
      residentId: resident.id,
      assignedUserId,
      assignedBy: req.user.id
    });

    res.json({
      success: true,
      data: resident
    });
  } catch (error) {
    logger.error('Error assigning resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign resident',
      message: error.message
    });
  }
});

router.delete('/residents/:id', requireNursingHomeAdmin, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const permanent =
      req.query.permanent === 'true' ||
      req.query.hard === 'true' ||
      req.body?.permanent === true;

    const resident = await NursingHomeResident.findByPk(id, { transaction });
    if (!resident) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Resident not found'
      });
    }

    if (req.user.role !== 'admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const residentName = resident.name;
    const residentOldValues = resident.toJSON();
    const facilityId = resident.facilityId;
    const linkedUserId = resident.userId;

    async function revokeLinkedLogin({ destroyProfile }) {
      if (!linkedUserId) return;
      await resident.update({ userId: null }, { transaction });
      const profile = await Profile.findByPk(linkedUserId, { transaction });
      if (!profile) return;
      if (profile.role === 'nursing_home_user') {
        if (destroyProfile) {
          await profile.destroy({ transaction });
        } else {
          await profile.update(
            { role: 'user', nursingHomeFacilityId: null },
            { transaction }
          );
        }
      }
    }

    if (permanent) {
      const orders = await NursingHomeResidentOrder.findAll({
        where: { residentId: id },
        attributes: ['id'],
        transaction
      });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0 && NursingHomeRefund) {
        await NursingHomeRefund.destroy({
          where: { residentOrderId: { [Op.in]: orderIds } },
          transaction
        });
      }
      await NursingHomeResidentOrder.destroy({ where: { residentId: id }, transaction });
      await revokeLinkedLogin({ destroyProfile: true });
      await resident.destroy({ transaction });
      await transaction.commit();

      await createAdminNotification({
        type: 'nh.resident.deleted',
        title: 'Nursing home: Resident deleted',
        message: `"${residentName}" was permanently deleted`,
        ref: { kind: 'nh_resident', id, facilityId }
      });
      await logAdminAction(req.user.id, 'DELETE', 'nh_residents', id, residentOldValues, null, req);
      logger.info('Resident permanently deleted', {
        residentId: id,
        deletedBy: req.user.id,
        loginRevoked: Boolean(linkedUserId)
      });
      return res.json({
        success: true,
        message: 'Resident deleted permanently',
        permanent: true
      });
    }

    await revokeLinkedLogin({ destroyProfile: false });
    await resident.update({ isActive: false, userId: null }, { transaction });
    await transaction.commit();

    await createAdminNotification({
      type: 'nh.resident.deactivated',
      title: 'Nursing home: Resident deactivated',
      message: `"${residentName}" was deactivated`,
      ref: { kind: 'nh_resident', id: resident.id, facilityId: resident.facilityId }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_residents', resident.id, residentOldValues, resident.toJSON(), req);
    logger.info('Resident deactivated', {
      residentId: resident.id,
      deactivatedBy: req.user.id,
      loginRevoked: Boolean(linkedUserId)
    });

    res.json({
      success: true,
      message: 'Resident deactivated successfully',
      permanent: false
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error deleting/deactivating resident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete resident',
      message: error.message
    });
  }
});

router.post('/residents/:id/payment-method', requireNursingHomeAdmin, [
  body('paymentMethodId').notEmpty().isString().trim(),
  body('billingEmail').optional().isEmail().normalizeEmail(),
  body('billingName').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('billingPhone').optional().isString().trim()
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
    const { paymentMethodId, billingEmail, billingName, billingPhone } = req.body;

    const resident = await NursingHomeResident.findByPk(id);
    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    if (req.user.role !== 'admin' && resident.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const client = stripe();
    if (!client) {
      return res.status(503).json({
        success: false,
        error: 'Payment provider not configured',
        message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment.'
      });
    }

    const stripePaymentMethod = await client.paymentMethods.retrieve(paymentMethodId);

    let customerId = resident.stripeCustomerId;
    if (!stripePaymentMethod.customer) {
      let customer;
      if (customerId) {
        customer = await client.customers.retrieve(customerId);
      } else {
        customer = await client.customers.create({
          email: billingEmail || resident.billingEmail || undefined,
          name: billingName || resident.billingName || resident.name,
          phone: billingPhone || resident.billingPhone || undefined,
          metadata: {
            residentId: resident.id,
            facilityId: resident.facilityId,
            type: 'nursing_home_resident'
          }
        });
        customerId = customer.id;
      }

      await client.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } else {
      customerId = stripePaymentMethod.customer;
    }

    const updatePayload = {
      paymentMethodId,
      stripeCustomerId: customerId
    };
    if (billingEmail !== undefined) updatePayload.billingEmail = billingEmail;
    if (billingName !== undefined) updatePayload.billingName = billingName;
    if (billingPhone !== undefined) updatePayload.billingPhone = billingPhone;

    const oldValues = resident.toJSON();
    await resident.update(updatePayload);
    await logAdminAction(req.user.id, 'UPDATE', 'nh_residents', resident.id, oldValues, resident.toJSON(), req);

    logger.info('Resident payment method saved', {
      residentId: resident.id,
      paymentMethodId,
      stripeCustomerId: customerId,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: resident,
      message: 'Payment method saved'
    });
  } catch (error) {
    logger.error('Error saving resident payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save payment method',
      message: error.message
    });
  }
});

router.post('/facilities/:id/billing/run-monthly', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id: facilityId } = req.params;

    if (req.user.role !== 'admin' && req.user.nursingHomeFacilityId !== facilityId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }

    const client = stripe();
    if (!client) {
      return res.status(503).json({
        success: false,
        error: 'Payment provider not configured',
        message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment.'
      });
    }

    const pendingOrders = await NursingHomeResidentOrder.findAll({
      where: {
        facilityId,
        status: { [Op.in]: ['submitted', 'confirmed'] },
        paymentStatus: { [Op.in]: ['pending', 'pending_monthly'] }
      },
      include: [{ model: NursingHomeResident, as: 'resident' }],
      order: [['createdAt', 'ASC']]
    });

    const ordersByResident = new Map();
    for (const order of pendingOrders) {
      const key = order.residentId;
      if (!ordersByResident.has(key)) ordersByResident.set(key, []);
      ordersByResident.get(key).push(order);
    }

    const summary = {
      facilityId,
      residentsCharged: 0,
      residentsSkipped: 0,
      ordersPaid: 0,
      totalCharged: 0,
      charged: [],
      skipped: [],
      failed: []
    };

    for (const [residentId, orders] of ordersByResident.entries()) {
      const resident = orders[0].resident || await NursingHomeResident.findByPk(residentId);
      const amount = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

      if (!resident?.paymentMethodId || amount <= 0) {
        summary.residentsSkipped += 1;
        summary.skipped.push({
          residentId,
          residentName: resident?.name || orders[0].residentName,
          reason: !resident?.paymentMethodId ? 'no_payment_method' : 'zero_amount',
          orderCount: orders.length,
          amount
        });
        continue;
      }

      try {
        const paymentIntent = await client.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          customer: resident.stripeCustomerId || undefined,
          payment_method: resident.paymentMethodId,
          confirm: true,
          off_session: true,
          description: `Monthly meal billing - ${resident.name} - ${facility.name}`,
          metadata: {
            facilityId,
            residentId,
            orderIds: orders.map((o) => o.id).join(','),
            type: 'nh_monthly_billing'
          },
          receipt_email: resident.billingEmail || undefined,
          statement_descriptor: 'MKD MEALS'
        });

        for (const order of orders) {
          await order.update({
            status: order.status === 'submitted' || order.status === 'confirmed' ? 'paid' : order.status,
            paymentStatus: 'paid',
            paymentMethod: 'stripe',
            paymentIntentId: paymentIntent.id,
            paidAt: new Date()
          });
        }

        summary.residentsCharged += 1;
        summary.ordersPaid += orders.length;
        summary.totalCharged += amount;
        const subtotal = orders.reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0);
        const tax = orders.reduce((sum, o) => sum + parseFloat(o.tax || 0), 0);
        summary.charged.push({
          residentId,
          residentName: resident.name,
          billingEmail: resident.billingEmail || null,
          billingName: resident.billingName || resident.name,
          facilityName: facility.name,
          amount: parseFloat(amount.toFixed(2)),
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          orderCount: orders.length,
          paymentIntentId: paymentIntent.id,
          orderIds: orders.map((o) => o.id),
          orderNumbers: orders.map((o) => o.orderNumber).filter(Boolean),
          weeks: orders.map((o) => ({
            orderNumber: o.orderNumber,
            weekStartDate: o.weekStartDate,
            weekEndDate: o.weekEndDate,
            total: parseFloat(o.total || 0),
            mealCount: Array.isArray(o.meals)
              ? o.meals.filter((m) => m && !m.none && Array.isArray(m.items) && m.items.length > 0).length
              : 0
          }))
        });
      } catch (stripeError) {
        logger.error('Monthly billing charge failed:', stripeError, { residentId, facilityId });
        for (const order of orders) {
          await order.update({ paymentStatus: 'failed' });
        }
        summary.failed.push({
          residentId,
          residentName: resident.name,
          amount: parseFloat(amount.toFixed(2)),
          orderCount: orders.length,
          error: stripeError.message
        });
      }
    }

    summary.totalCharged = parseFloat(summary.totalCharged.toFixed(2));

    await logAdminAction(req.user.id, 'CREATE', 'nh_monthly_billing', facilityId, null, summary, req);
    logger.info('Monthly billing run completed', {
      facilityId,
      chargedBy: req.user.id,
      residentsCharged: summary.residentsCharged,
      ordersPaid: summary.ordersPaid,
      totalCharged: summary.totalCharged
    });

    res.json({
      success: true,
      data: summary,
      message: 'Monthly billing run completed'
    });
  } catch (error) {
    logger.error('Error running monthly billing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run monthly billing',
      message: error.message
    });
  }
});

router.get('/menu', requireNursingHomeUser, menuQueryValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid query parameters',
        details: errors.array()
      });
    }
    const { mealType, category, isActive = 'true' } = req.query;

    const where = { isActive: isActive === 'true' };
    if (mealType) {
      where.mealType = mealType;
    }
    if (category) {
      where.category = category;
    }

    const menuItems = await NursingHomeMenuItem.findAll({
      where,
      order: [['mealType', 'ASC'], ['category', 'ASC'], ['displayOrder', 'ASC']]
    });

    const groupedMenu = {
      breakfast: {
        main: [],
        side: []
      },
      lunch: {
        entree: [],
        side: []
      },
      dinner: {
        entree: [],
        side: [],
        soup: [],
        dessert: []
      }
    };

    menuItems.forEach(item => {
      if (groupedMenu[item.mealType] && groupedMenu[item.mealType][item.category]) {
        groupedMenu[item.mealType][item.category].push(item);
      }
    });

    res.json({
      success: true,
      data: {
        items: menuItems,
        grouped: groupedMenu
      }
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
    const { id } = req.params;

    const menuItem = await NursingHomeMenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    logger.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item',
      message: error.message
    });
  }
});

router.post('/menu', requireAdmin, [
  body('mealType').isIn(['breakfast', 'lunch', 'dinner']),
  body('category').isIn(['main', 'side', 'entree', 'dessert', 'soup']),
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('price').isDecimal(),
  body('requiresBagelType').optional().isBoolean(),
  body('excludesSide').optional().isBoolean(),
  body('displayOrder').optional().isInt()
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

    const menuItem = await NursingHomeMenuItem.create(req.body);
    await createAdminNotification({
      type: 'nh.menu.created',
      title: 'Nursing home: Menu item added',
      message: `"${menuItem.name}" (${menuItem.mealType}) added`,
      ref: { kind: 'nh_menu_item', id: menuItem.id, name: menuItem.name }
    });
    await logAdminAction(req.user.id, 'CREATE', 'nh_menu', menuItem.id, null, menuItem.toJSON(), req);
    logger.info('Menu item created', {
      menuItemId: menuItem.id,
      name: menuItem.name,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    logger.error('Error creating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create menu item',
      message: error.message
    });
  }
});

router.put('/menu/:id', requireAdmin, [
  body('mealType').optional().isIn(['breakfast', 'lunch', 'dinner']),
  body('category').optional().isIn(['main', 'side', 'entree', 'dessert', 'soup']),
  body('name').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('price').optional().isDecimal(),
  body('requiresBagelType').optional().isBoolean(),
  body('excludesSide').optional().isBoolean(),
  body('displayOrder').optional().isInt(),
  body('isActive').optional().isBoolean()
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

    const menuItem = await NursingHomeMenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    const menuOldValues = menuItem.toJSON();
    await menuItem.update(req.body);
    await createAdminNotification({
      type: 'nh.menu.updated',
      title: 'Nursing home: Menu item updated',
      message: `"${menuItem.name}" was updated`,
      ref: { kind: 'nh_menu_item', id: menuItem.id, name: menuItem.name }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_menu', menuItem.id, menuOldValues, menuItem.toJSON(), req);
    logger.info('Menu item updated', {
      menuItemId: menuItem.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    logger.error('Error updating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update menu item',
      message: error.message
    });
  }
});

router.delete('/menu/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await NursingHomeMenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    const itemName = menuItem.name;
    const menuOldValues = menuItem.toJSON();
    await menuItem.update({ isActive: false });
    await createAdminNotification({
      type: 'nh.menu.deactivated',
      title: 'Nursing home: Menu item deactivated',
      message: `"${itemName}" was deactivated`,
      ref: { kind: 'nh_menu_item', id: menuItem.id }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_menu', menuItem.id, menuOldValues, menuItem.toJSON(), req);
    logger.info('Menu item deactivated', {
      menuItemId: menuItem.id,
      deactivatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Menu item deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate menu item',
      message: error.message
    });
  }
});

function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-NH-${year}${month}-${random}`;
}

router.get('/invoices', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, facilityId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    if (req.user.role === 'admin') {
      if (req.query.facilityId) {
        where.facilityId = req.query.facilityId;
      }
    } else if (req.user.role === 'nursing_home_admin') {
      where.facilityId = req.user.nursingHomeFacilityId;
    } else if (facilityId) {
      where.facilityId = facilityId;
    }

    if (status) {
      where.status = status;
    }

    const { count, rows: invoices } = await NursingHomeInvoice.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address', 'contactEmail']
        }
      ]
    });

    res.json({
      success: true,
      data: invoices,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices',
      message: error.message
    });
  }
});

router.get('/invoices/:id', requireNursingHomeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await NursingHomeInvoice.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility',
          attributes: ['id', 'name', 'address', 'contactEmail', 'contactPhone', 'billingFrequency']
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    if (req.user.role !== 'admin' && invoice.facilityId !== req.user.nursingHomeFacilityId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const orders = await NursingHomeOrder.findAll({
      where: {
        id: invoice.orderIds
      },
      attributes: ['id', 'orderNumber', 'weekStartDate', 'weekEndDate', 'totalMeals', 'subtotal', 'tax', 'total']
    });

    res.json({
      success: true,
      data: {
        ...invoice.toJSON(),
        orders
      }
    });
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice',
      message: error.message
    });
  }
});

router.post('/invoices/generate', requireAdmin, [
  body('facilityId').isUUID(),
  body('billingPeriodStart').isDate(),
  body('billingPeriodEnd').isDate(),
  body('dueDate').optional().isDate()
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

    const { facilityId, billingPeriodStart, billingPeriodEnd, dueDate } = req.body;

    const facility = await NursingHomeFacility.findByPk(facilityId);
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    const orders = await NursingHomeOrder.findAll({
      where: {
        facilityId,
        status: 'submitted',
        weekStartDate: {
          [require('sequelize').Op.gte]: billingPeriodStart
        },
        weekEndDate: {
          [require('sequelize').Op.lte]: billingPeriodEnd
        }
      }
    });

    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No submitted orders found for this period'
      });
    }

    let totalMeals = 0;
    let subtotal = 0;
    let tax = 0;
    const orderIds = [];

    orders.forEach(order => {
      totalMeals += order.totalMeals;
      subtotal += parseFloat(order.subtotal);
      tax += parseFloat(order.tax);
      orderIds.push(order.id);
    });

    const total = subtotal + tax;
    const invoiceNumber = generateInvoiceNumber();
    const calculatedDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await NursingHomeInvoice.create({
      facilityId,
      invoiceNumber,
      billingPeriodStart,
      billingPeriodEnd,
      orderIds,
      totalMeals,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      status: 'draft',
      dueDate: calculatedDueDate
    });
    await createAdminNotification({
      type: 'nh.invoice.generated',
      title: 'Nursing home: Invoice generated',
      message: `Invoice ${invoice.invoiceNumber} for ${facility.name} (${orders.length} orders)`,
      ref: { kind: 'nh_invoice', id: invoice.id, facilityId, invoiceNumber: invoice.invoiceNumber }
    });
    await logAdminAction(req.user.id, 'CREATE', 'nh_invoices', invoice.id, null, invoice.toJSON(), req);
    logger.info('Invoice generated', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      facilityId,
      orderCount: orders.length,
      generatedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate invoice',
      message: error.message
    });
  }
});

router.put('/invoices/:id', requireAdmin, [
  body('dueDate').optional().isDate(),
  body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
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

    const invoice = await NursingHomeInvoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    const invoiceOldValues = invoice.toJSON();
    await invoice.update(updateData);
    await createAdminNotification({
      type: 'nh.invoice.updated',
      title: 'Nursing home: Invoice updated',
      message: `Invoice ${invoice.invoiceNumber} was updated`,
      ref: { kind: 'nh_invoice', id: invoice.id, invoiceNumber: invoice.invoiceNumber }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_invoices', invoice.id, invoiceOldValues, invoice.toJSON(), req);
    logger.info('Invoice updated', {
      invoiceId: invoice.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update invoice',
      message: error.message
    });
  }
});

router.post('/invoices/:id/send', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await NursingHomeInvoice.findByPk(id, {
      include: [
        {
          model: NursingHomeFacility,
          as: 'facility'
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    if (invoice.status === 'sent') {
      return res.status(400).json({
        success: false,
        error: 'Invoice already sent'
      });
    }

    const invoiceOldValues = invoice.toJSON();
    await invoice.update({ status: 'sent' });
    await createAdminNotification({
      type: 'nh.invoice.sent',
      title: 'Nursing home: Invoice sent',
      message: `Invoice ${invoice.invoiceNumber} was sent to facility`,
      ref: { kind: 'nh_invoice', id: invoice.id, invoiceNumber: invoice.invoiceNumber }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_invoices', invoice.id, invoiceOldValues, invoice.toJSON(), req);
    logger.info('Invoice sent', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      facilityId: invoice.facilityId,
      sentBy: req.user.id
    });

    res.json({
      success: true,
      data: invoice,
      message: 'Invoice sent successfully'
    });
  } catch (error) {
    logger.error('Error sending invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invoice',
      message: error.message
    });
  }
});

router.post('/invoices/:id/mark-paid', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await NursingHomeInvoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Invoice already marked as paid'
      });
    }

    const invoiceOldValues = invoice.toJSON();
    await invoice.update({
      status: 'paid',
      paidAt: new Date()
    });
    await createAdminNotification({
      type: 'nh.invoice.paid',
      title: 'Nursing home: Invoice paid',
      message: `Invoice ${invoice.invoiceNumber} marked as paid`,
      ref: { kind: 'nh_invoice', id: invoice.id, invoiceNumber: invoice.invoiceNumber }
    });
    await logAdminAction(req.user.id, 'UPDATE', 'nh_invoices', invoice.id, invoiceOldValues, invoice.toJSON(), req);
    logger.info('Invoice marked as paid', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      markedBy: req.user.id
    });

    res.json({
      success: true,
      data: invoice,
      message: 'Invoice marked as paid'
    });
  } catch (error) {
    logger.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark invoice as paid',
      message: error.message
    });
  }
});

module.exports = router;

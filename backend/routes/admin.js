const express = require('express');
const { Op, QueryTypes } = require('sequelize');
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
const { Profile, Order, Restaurant, DeliveryZone, SupportTicket, TicketResponse, AdminNotification, Notification, AdminAuditLog, sequelize, MenuItem, MenuItemOption, UserRestaurantFavorite, MenuChangeRequest, UserLoginActivity, UserPreference, UserAnalytic, PaymentMethod, RestaurantOwner, Refund, PromoCode, GiftCard } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');
const { VALID_PROFILE_ROLES } = require('../config/constants');
const logger = require('../utils/logger');
const { isMissingColumnError, getProfileById, getProfilesForAdminList, countProfilesRaw, updateProfileSafe, profileExistsWithEmail } = require('../utils/profileFallback');
const jwt = require('jsonwebtoken');
const { appEvents } = require('../utils/events');
const { logAdminAction } = require('../utils/auditLog');
const { validateMenuItemData, normalizeMenuItemData } = require('../utils/menuItemValidation');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');

async function createGlobalAdminNotification(payload) {
  try {
    const notif = await AdminNotification.create({
      type: payload.type,
      title: payload.title,
      message: payload.body || payload.message || '',
      readBy: [],
      data: payload.ref || null
    });
    
    try { 
      appEvents.emit('admin.notification.created', { 
        id: notif.id, 
        type: notif.type, 
        title: notif.title, 
        message: notif.message, 
        data: notif.data, 
        createdAt: notif.createdAt 
      }); 
    } catch (err) { 
      logger.warn('Emit admin notification error', err); 
    }
    
    return notif;
  } catch (err) { 
    logger.warn('Create global admin notification error', err); 
    return null;
  }
}

const router = express.Router();

const uploadsDir = path.resolve(__dirname, '..', 'public', 'restaurant-logos');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { logger.warn('Failed to ensure uploads dir', e); }
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeBase = String(file.originalname).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
    cb(null, safeBase);
  }
});
const upload = multer({ storage });

router.post('/orders/stream-token', requireAdmin, async (req, res) => {
  try {
    const token = jwt.sign(
      { userId: req.user.id, scope: 'orders_stream' },
      process.env.JWT_SECRET,
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    res.json({ token });
  } catch (error) {
    logger.error('Error issuing stream token:', error);
    res.status(500).json({ error: 'Failed to issue stream token' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { role, limit = 20, offset = 0, search, page = 1 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 10000);
    const offsetNum = parseInt(offset, 10) || (parseInt(page, 10) - 1) * limitNum;

    let total;
    let transformedUsers;

    try {
      const whereClause = {};
      if (role && role !== 'all') {
        whereClause.role = role;
      }
      if (search) {
        whereClause[Op.or] = [
          { email: { [Op.iLike]: `%${search}%` } },
          { first_name: { [Op.iLike]: `%${search}%` } },
          { last_name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } }
        ];
      }

      total = await Profile.count({ where: whereClause });

      const users = await Profile.findAll({
        where: whereClause,
        attributes: [
          'id', 'email', 'firstName', 'lastName', 'phone', 'address', 'addresses',
          'primaryAddressIndex', 'role', 'nursingHomeFacilityId', 'createdAt', 'updatedAt',
          [
            sequelize.literal(`(
              SELECT login_time
              FROM user_login_activities
              WHERE user_id = "Profile"."id"
              ORDER BY login_time DESC
              LIMIT 1
            )`),
            'last_login'
          ]
        ],
        order: [['createdAt', 'DESC']],
        limit: limitNum,
        offset: offsetNum
      });

      transformedUsers = users.map(user => {
        const userData = user.toJSON();
        return {
          id: userData.id,
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: userData.email,
          phone_number: userData.phone,
          role: userData.role,
          created_at: userData.createdAt,
          last_login: userData.last_login,
          address: userData.address,
          addresses: userData.addresses,
          primary_address_index: userData.primaryAddressIndex,
          nursing_home_facility_id: userData.nursingHomeFacilityId ?? null
        };
      });
      logger.debug('GET /admin/users (Sequelize path)', { total: transformedUsers.length, sampleFacilityId: transformedUsers[0]?.nursing_home_facility_id });
    } catch (dbErr) {
      if (isMissingColumnError(dbErr)) {
        logger.debug('GET /admin/users (fallback path)', { reason: dbErr.message?.slice(0, 80) });
        transformedUsers = await getProfilesForAdminList({ role, search, limit: limitNum, offset: offsetNum });
        logger.debug('GET /admin/users fallback result', { total: transformedUsers?.length, sampleFacilityId: transformedUsers?.[0]?.nursing_home_facility_id });
        let whereClause = '1=1';
        const countReplacements = {};
        if (role && role !== 'all') {
          whereClause += ' AND role = :role';
          countReplacements.role = role;
        }
        if (search && search.trim()) {
          whereClause += ` AND (LOWER(email) LIKE LOWER(:search) OR LOWER(first_name) LIKE LOWER(:search) OR LOWER(last_name) LIKE LOWER(:search) OR phone LIKE :searchPhone)`;
          countReplacements.search = `%${search.trim()}%`;
          countReplacements.searchPhone = `%${search.trim()}%`;
        }
        total = await countProfilesRaw(whereClause, countReplacements);
      } else {
        throw dbErr;
      }
    }

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: transformedUsers,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limitNum,
        total,
        totalPages,
        hasNext: (parseInt(page, 10) || 1) < totalPages,
        hasPrev: (parseInt(page, 10) || 1) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch users'
    });
  }
});

router.get('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    let user = null;
    try {
      user = await Profile.findByPk(userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'address', 'addresses', 'primaryAddressIndex', 'role', 'nursingHomeFacilityId', 'createdAt', 'updatedAt']
      });
    } catch (findErr) {
      if (isMissingColumnError(findErr)) {
        user = await getProfileById(userId);
      } else {
        throw findErr;
      }
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found', message: 'User does not exist' });
    }
    const data = typeof user.toJSON === 'function' ? user.toJSON() : user;
    const transformed = {
      id: data.id,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone_number: data.phone,
      role: data.role,
      created_at: data.createdAt,
      last_login: null,
      address: data.address,
      addresses: data.addresses,
      primary_address_index: data.primaryAddressIndex,
      nursing_home_facility_id: data.nursingHomeFacilityId ?? null
    };
    return res.json({ success: true, data: transformed });
  } catch (error) {
    logger.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch user' });
  }
});

router.put('/users/:userId', requireAdmin, [
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('first_name').optional({ checkFalsy: true }).trim().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional({ checkFalsy: true }).trim().notEmpty().withMessage('Last name cannot be empty'),
  body('phone_number').optional().trim(),
  body('role').optional().isIn(VALID_PROFILE_ROLES).withMessage('Invalid role'),
  body('nursing_home_facility_id').optional().custom((val) => !val || val === '' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim())).withMessage('Facility must be a valid UUID')
], async (req, res) => {
  const putUserId = req.params.userId;
  logger.info('PUT /admin/users/:userId', { userId: putUserId, bodyKeys: Object.keys(req.body || {}), role: req.body?.role, nursing_home_facility_id: req.body?.nursing_home_facility_id });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('[PUT /admin/users/:userId] Validation failed', errors.array());
      const bodyForLog = { ...req.body };
      delete bodyForLog.password;
      logger.warn('Validation errors for user update:', {
        userId: req.params.userId,
        errors: errors.array(),
        body: bodyForLog
      });
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array().map(e => e.msg).join(', '),
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const updates = req.body;

    const nursingHomeRoles = ['nursing_home_admin', 'nursing_home_user'];
    if (updates.role && nursingHomeRoles.includes(String(updates.role).trim())) {
      const facilityVal = updates.nursing_home_facility_id != null && String(updates.nursing_home_facility_id).trim() !== '';
      if (!facilityVal) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Nursing Home Admin and Nursing Home User roles require a facility to be assigned.'
        });
      }
    }

    delete updates.password;

    let user = null;
    let useRawPath = false;
    try {
      user = await Profile.findByPk(userId);
    } catch (findErr) {
      if (isMissingColumnError(findErr)) {
        user = await getProfileById(userId);
        useRawPath = true;
      } else {
        throw findErr;
      }
    }
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const transformedUpdates = {};
    if (updates.first_name !== undefined) {
      transformedUpdates.firstName = updates.first_name ? updates.first_name.trim() : null;
    }
    if (updates.last_name !== undefined) {
      transformedUpdates.lastName = updates.last_name ? updates.last_name.trim() : null;
    }
    if (updates.phone_number !== undefined) {
      transformedUpdates.phone = updates.phone_number && updates.phone_number.trim() ? updates.phone_number.trim() : null;
    }
    if (updates.role !== undefined) {
      const roleVal = String(updates.role).trim();
      if (!VALID_PROFILE_ROLES.includes(roleVal)) {
        return res.status(400).json({
          error: 'Invalid role',
          message: `Role must be one of: ${VALID_PROFILE_ROLES.join(', ')}`
        });
      }

      try {
        const enumRows = await sequelize.query(`
          SELECT enumlabel FROM pg_enum 
          WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_profiles_role')
          AND enumlabel = :role
        `, {
          replacements: { role: roleVal },
          type: QueryTypes.SELECT
        });
        const enumValues = Array.isArray(enumRows) ? enumRows : [];
        if (enumValues.length === 0) {
          logger.warn('Role enum value not found in database', { role: roleVal });
          return res.status(400).json({
            error: 'Invalid role',
            message: `The role "${roleVal}" is not available in the database. Run: node scripts/check-profile-role-enum.js`
          });
        }
      } catch (enumCheckError) {
        logger.warn('Enum check failed, proceeding with update', { error: enumCheckError.message });
      }

      transformedUpdates.role = roleVal;
      logger.info('Updating user role', {
        userId: userId,
        oldRole: user.role,
        newRole: roleVal
      });
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'nursing_home_facility_id')) {
      const raw = updates.nursing_home_facility_id;
      const val = raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
      transformedUpdates.nursingHomeFacilityId = val;
      logger.debug('PUT /admin/users/:userId facility', { received: raw, applied: val, useRawPath });
    }
    if (updates.email !== undefined && updates.email !== user.email) {
      if (useRawPath) {
        const emailTaken = await profileExistsWithEmail(updates.email, userId);
        if (emailTaken) {
          return res.status(400).json({
            error: 'Email already in use',
            message: 'Another user with this email already exists'
          });
        }
      } else {
        const existingUser = await Profile.findOne({ where: { email: updates.email } });
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({
            error: 'Email already in use',
            message: 'Another user with this email already exists'
          });
        }
      }
      transformedUpdates.email = updates.email;
    }

    if (Object.keys(transformedUpdates).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'At least one field must be updated'
      });
    }

    const oldValues = useRawPath ? { ...user } : user.toJSON();
    delete oldValues.password;

    let newValues;
    try {
      if (useRawPath) {
        const updated = await updateProfileSafe(userId, transformedUpdates);
        if (!updated) {
          return res.status(500).json({
            error: 'Update failed',
            message: 'Failed to update user profile'
          });
        }
        newValues = { ...updated, last_login: updated.last_login ?? null };
      } else {
        await user.update(transformedUpdates);
        await user.reload();
        newValues = user.toJSON();
      }
    } catch (updateError) {
      if (isMissingColumnError(updateError) && transformedUpdates.nursingHomeFacilityId !== undefined) {
        delete transformedUpdates.nursingHomeFacilityId;
        if (Object.keys(transformedUpdates).length === 0) {
          return res.status(400).json({
            error: 'Database migration required',
            message: 'Facility assignment requires the nursing_home_facility_id column. Run your database migrations on this environment (e.g. Heroku Postgres) to enable it.'
          });
        }
        try {
          if (useRawPath) {
            const updated = await updateProfileSafe(userId, transformedUpdates);
            if (!updated) {
              return res.status(500).json({ error: 'Update failed', message: 'Failed to update user profile' });
            }
            newValues = { ...updated, last_login: updated.last_login ?? null };
          } else {
            await user.update(transformedUpdates);
            await user.reload();
            newValues = user.toJSON();
          }
        } catch (retryErr) {
          logger.error('Sequelize update error (after dropping facility):', { error: retryErr.message, userId });
          return res.status(400).json({
            error: 'Update failed',
            message: retryErr.original?.message || retryErr.message || 'Failed to update user profile'
          });
        }
      } else {
        console.error('[ERROR] Sequelize update error:', {
          name: updateError.name,
          message: updateError.message,
          originalMessage: updateError.original?.message,
          originalCode: updateError.original?.code,
          userId: userId,
          transformedUpdates: transformedUpdates,
          stack: updateError.stack?.substring(0, 500)
        });
        logger.error('Sequelize update error:', {
          error: updateError.message,
          name: updateError.name,
          userId: userId,
          updates: transformedUpdates,
          stack: updateError.stack
        });

        if (updateError.name === 'SequelizeValidationError') {
          return res.status(400).json({
            error: 'Validation error',
            message: updateError.errors.map(e => e.message).join(', ')
          });
        }

        if (updateError.name === 'SequelizeUniqueConstraintError') {
          return res.status(400).json({
            error: 'Unique constraint violation',
            message: 'A user with this information already exists'
          });
        }

        const errMsg = (updateError.original?.message || updateError.message || 'Update failed').toString();
        const isEnumError = /enum|invalid input value/i.test(errMsg);
        if (updateError.name === 'SequelizeDatabaseError' || updateError.original || isEnumError) {
          if (isEnumError) {
            return res.status(400).json({
              error: 'Invalid role value',
              message: 'The selected role is not valid. Please ensure the database migrations have been run.'
            });
          }
          return res.status(400).json({
            error: 'Database error',
            message: errMsg || 'Failed to update user due to a database constraint'
          });
        }
        return res.status(400).json({
          error: 'Update failed',
          message: errMsg
        });
      }
    }

    delete newValues.password;

    if (req.user?.id) {
      try {
        await logAdminAction(
          req.user.id,
          'UPDATE',
          'profiles',
          userId,
          oldValues,
          newValues,
          req
        );
      } catch (auditError) {
        logger.error('Failed to log admin action for user update:', auditError);
      }
    }

    try {
      await createGlobalAdminNotification({
        type: 'user.updated',
        title: 'User Updated',
        message: `User "${user.firstName} ${user.lastName}" (${user.email}) has been updated by admin`,
        ref: { kind: 'user', id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email }
      });
    } catch (notifError) {
      logger.warn('Failed to create user update notification:', notifError);
    }

    const transformedUser = {
      id: newValues.id,
      first_name: newValues.firstName,
      last_name: newValues.lastName,
      email: newValues.email,
      phone_number: newValues.phone,
      role: newValues.role,
      created_at: newValues.createdAt,
      last_login: newValues.last_login ?? null,
      address: newValues.address,
      addresses: newValues.addresses,
      primary_address_index: newValues.primaryAddressIndex,
      nursing_home_facility_id: newValues.nursingHomeFacilityId ?? null
    };
    
    res.json({
      success: true,
      data: transformedUser,
      message: 'User profile updated successfully'
    });

  } catch (error) {
    const errMsg = error?.message || 'Unknown error';
    const origMsg = error?.original?.message;
    const errorMessage = (origMsg || errMsg || 'Failed to update user profile').toString();
    const errorName = error?.name || 'Error';
    console.error('[PUT /admin/users/:userId] 500 ERROR', errorName, errMsg, origMsg ? `(original: ${origMsg})` : '');
    console.error('[PUT /admin/users/:userId] Full stack:\n', error?.stack || '(no stack)');
    logger.error('Error updating user profile', {
      name: errorName,
      message: errMsg,
      originalMessage: origMsg,
      userId: putUserId
    });

    const isValidationError = error?.name === 'SequelizeValidationError' || error?.name === 'ValidationError';
    const isDatabaseError = error?.name === 'SequelizeDatabaseError' || error?.original;

    if (isDatabaseError && /enum|invalid input value/i.test(errorMessage)) {
      return res.status(400).json({
        error: 'Invalid role value',
        message: 'The selected role is not valid. Run: node backend/scripts/check-profile-role-enum.js and ensure migrations are applied.'
      });
    }

    const status = isValidationError ? 400 : 500;
    const body = {
      error: isValidationError ? 'Validation error' : 'Internal server error',
      message: `${errorName}: ${errorMessage}`
    };
    body.serverErrorName = errorName;
    if (error?.stack) body.serverStack = error.stack.split('\n').slice(0, 12).join('\n');
    return res.status(status).json(body);
  }
});

router.patch('/users/:userId/role', requireAdmin, [
  body('role').isIn(VALID_PROFILE_ROLES)
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = await Profile.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const oldValues = user.toJSON();
    delete oldValues.password;

    await user.update({ role });

    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'profiles',
        userId,
        oldValues,
        user.toJSON(),
        req
      );
    } catch (auditError) {
      logger.error('Failed to log admin action for role update:', auditError);
    }

    const safeUserJson = user.toJSON();
    delete safeUserJson.password;
    const userData = safeUserJson;
    
    res.json({
      success: true,
      data: userData,
      message: `User role updated to ${role}`
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user role'
    });
  }
});

router.post('/users', requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*\d)/)
    .withMessage('Password must contain at least one number')
    .matches(/^(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one special character'),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('role').isIn(VALID_PROFILE_ROLES),
  body('nursing_home_facility_id').optional().custom((val) => !val || val === '' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim())).withMessage('Facility must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, firstName, lastName, role, phone, nursing_home_facility_id: nursingHomeFacilityIdParam } = req.body;
    const nursingHomeFacilityId = nursingHomeFacilityIdParam && String(nursingHomeFacilityIdParam).trim() ? String(nursingHomeFacilityIdParam).trim() : null;

    const nursingHomeRoles = ['nursing_home_admin', 'nursing_home_user'];
    if (role && nursingHomeRoles.includes(String(role).trim()) && !nursingHomeFacilityId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Nursing Home Admin and Nursing Home User roles require a facility to be assigned.'
      });
    }

    const existingUser = await Profile.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    const user = await Profile.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'user',
      phone: phone || null,
      ...(nursingHomeFacilityId && { nursingHomeFacilityId })
    });

    await logAdminAction(
      req.user.id,
      'CREATE',
      'profiles',
      user.id,
      null,
      { email, firstName, lastName, role },
      req
    );

    try {
      await createGlobalAdminNotification({
        type: 'user.created',
        title: 'New User Created',
        message: `User "${firstName} ${lastName}" (${email}) has been created by admin`,
        ref: { kind: 'user', id: user.id, name: `${firstName} ${lastName}`, email }
      });
    } catch (notifError) {
      logger.warn('Failed to create user creation notification:', notifError);
    }

    const userData = user.toJSON();
    delete userData.password;
    const transformedUser = {
      id: userData.id,
      first_name: userData.firstName,
      last_name: userData.lastName,
      email: userData.email,
      phone_number: userData.phone,
      role: userData.role,
      created_at: userData.createdAt,
      last_login: null,
      address: userData.address,
      addresses: userData.addresses,
      primary_address_index: userData.primaryAddressIndex
    };

    res.status(201).json({
      success: true,
      data: transformedUser,
      message: 'User created successfully'
    });

  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user'
    });
  }
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await Profile.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    if (user.role === 'admin') {
      const adminCount = await Profile.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Cannot delete last admin',
          message: 'At least one admin must remain in the system'
        });
      }
    }

    try {
      await createGlobalAdminNotification({
        type: 'user.deleted',
        title: 'User Deleted',
        message: `User "${user.firstName} ${user.lastName}" (${user.email}) has been deleted by admin`,
        ref: { kind: 'user', id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email }
      });
    } catch (notifError) {
      logger.warn('Failed to create user deletion notification:', notifError);
    }

    const relatedTables = [
      { model: Notification, field: 'userId', name: 'notifications' },
      { model: UserRestaurantFavorite, field: 'userId', name: 'restaurant favorites' },
      { model: UserLoginActivity, field: 'userId', name: 'login activities' },
      { model: UserPreference, field: 'userId', name: 'preferences' },
      { model: UserAnalytic, field: 'userId', name: 'analytics' },
      { model: PaymentMethod, field: 'userId', name: 'payment methods' },
      { model: RestaurantOwner, field: 'userId', name: 'restaurant ownership' },
      { model: SupportTicket, field: 'userId', name: 'support tickets (as customer)' },
      { model: SupportTicket, field: 'assignedTo', name: 'support tickets (as assigned admin)' }
    ];

    const additionalCleanup = [
      { model: AdminAuditLog, field: 'adminId', name: 'admin audit logs' },
      { model: MenuChangeRequest, field: 'requestedBy', name: 'menu change requests (as requester)' },
      { model: MenuChangeRequest, field: 'approvedBy', name: 'menu change requests (as approver)' },
      { model: Refund, field: 'processedBy', name: 'refunds (as processor)' },
      { model: TicketResponse, field: 'responderId', name: 'ticket responses' }
    ];

    const allCleanupTasks = [...relatedTables, ...additionalCleanup];

    for (const { model, field, name } of allCleanupTasks) {
      try {
        const whereClause = { [field]: userId };
        const deletedCount = await model.destroy({ where: whereClause });
        if (deletedCount > 0) {
          logger.info(`Deleted ${deletedCount} ${name} for user ${userId}`);
        }
      } catch (error) {
        logger.warn(`Failed to delete ${name} for user ${userId}:`, error.message);
      }
    }

    try {
      const orderCountResult = await sequelize.query(
        'SELECT COUNT(*) as count FROM orders WHERE user_id = :userId',
        {
          replacements: { userId: userId },
          type: QueryTypes.SELECT
        }
      );
      const orderCount = parseInt(orderCountResult[0]?.count || 0);
      
      if (orderCount > 0) {
        logger.info(`Found ${orderCount} orders for user ${userId}, deleting them using raw SQL`);
        
        await sequelize.query(
          'DELETE FROM orders WHERE user_id = :userId',
          {
            replacements: { userId: userId },
            type: QueryTypes.DELETE
          }
        );
        
        logger.info(`Deleted orders for user ${userId} using raw SQL`);
        
        const verifyResult = await sequelize.query(
          'SELECT COUNT(*) as count FROM orders WHERE user_id = :userId',
          {
            replacements: { userId: userId },
            type: QueryTypes.SELECT
          }
        );
        const remainingCount = parseInt(verifyResult[0]?.count || 0);
        
        if (remainingCount > 0) {
          logger.error(`CRITICAL: Still have ${remainingCount} orders after raw SQL deletion!`);
          throw new Error(`Failed to delete all orders. ${remainingCount} orders still remain.`);
        }
        
        logger.info(`Successfully verified all orders deleted for user ${userId}`);
      } else {
        logger.info(`No orders found for user ${userId}, proceeding with deletion`);
      }
      
    } catch (error) {
      logger.error(`Failed to handle orders for user ${userId}:`, error);
      return res.status(400).json({
        error: 'Cannot delete user',
        message: `Failed to delete user orders before deletion: ${error.message}`
      });
    }
    
    try {
      await logAdminAction(
        req.user.id,
        'DELETE',
        'profiles',
        userId,
        user.toJSON(),
        null,
        req
      );
    } catch (auditError) {
      logger.error('Audit logging failed:', auditError);
    }

    logger.info(`Verifying all references are cleaned up for user ${userId}`);
    const remainingChecks = {
      orders: await Order.count({ where: { userId: userId } }),
      notifications: await Notification.count({ where: { userId: userId } }),
      supportTickets: await SupportTicket.count({ where: { userId: userId } }),
      auditLogs: await AdminAuditLog.count({ where: { adminId: userId } }),
      menuRequests: await MenuChangeRequest.count({ 
        where: { 
          [Op.or]: [
            { requestedBy: userId },
            { approvedBy: userId }
          ]
        }
      })
    };
    
    const totalRemaining = Object.values(remainingChecks).reduce((sum, count) => sum + count, 0);
    logger.info(`Remaining references for user ${userId}:`, remainingChecks);
    
    if (totalRemaining > 0) {
      logger.warn(`User ${userId} still has ${totalRemaining} references remaining`);
      return res.status(400).json({
        error: 'Cannot delete user',
        message: `User still has ${totalRemaining} references in the database. Please ensure all related data is cleaned up first.`,
        details: remainingChecks
      });
    }

    try {
    await user.destroy({ force: true });
      logger.info(`Successfully deleted user ${userId} using Sequelize`);
    } catch (deleteError) {
      logger.warn(`Sequelize deletion failed for user ${userId}, trying raw SQL:`, deleteError.message);
      
      const isConstraintError = deleteError.name === 'SequelizeDatabaseError' && 
        (deleteError.message.includes('foreign key') || 
         deleteError.message.includes('constraint') ||
         deleteError.message.includes('not-null') ||
         deleteError.original?.code === '23503' ||
         deleteError.original?.code === '23502');
      
      if (isConstraintError) {
        try {
          logger.info(`Attempting raw SQL deletion for user ${userId} to bypass constraint`);
          
          await sequelize.query(
            'DELETE FROM profiles WHERE id = :userId',
            {
              replacements: { userId: userId },
              type: QueryTypes.DELETE
            }
          );
          
          logger.info(`Successfully deleted user ${userId} using raw SQL`);
        } catch (rawSqlError) {
          logger.error(`Raw SQL deletion also failed for user ${userId}:`, rawSqlError);
          
          const finalOrderCheck = await sequelize.query(
            'SELECT COUNT(*) as count FROM orders WHERE user_id = :userId',
            {
              replacements: { userId: userId },
              type: QueryTypes.SELECT
            }
          );
          const finalOrderCount = parseInt(finalOrderCheck[0]?.count || 0);
          
          return res.status(400).json({
            error: 'Cannot delete user due to database constraints',
            message: `Database constraint prevents deletion. ${finalOrderCount > 0 ? `Found ${finalOrderCount} orders still referencing this user.` : 'Raw SQL deletion failed.'} Error: ${rawSqlError.message}`,
            details: {
              constraint: deleteError.original?.constraint,
              table: deleteError.original?.table,
              column: deleteError.original?.column,
              code: deleteError.original?.code,
              remainingOrders: finalOrderCount
            }
          });
        }
      } else {
        throw deleteError;
      }
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting user:', error);
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await Profile.count();
    
    const usersByRole = await Profile.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    const totalOrders = await Order.count();
    
    const ordersByStatus = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    const totalRevenue = await Order.sum('total', {
      where: { status: ['delivered', 'confirmed'] }
    }) || 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentOrders = await Order.count({
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    const totalRestaurants = await Restaurant.count({
      where: { 
        active: true,
        deletedAt: null
      }
    });
    
    const featuredRestaurants = await Restaurant.count({
      where: { 
        featured: true,
        active: true,
        deletedAt: null
      }
    });

    const [giftCardCounts, giftCardTotalCount, totalInitial, totalBalance] = await Promise.all([
      GiftCard.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('initial_balance')), 'totalInitial'],
          [sequelize.fn('SUM', sequelize.col('balance')), 'totalBalance']
        ],
        group: ['status'],
        raw: true
      }),
      GiftCard.count(),
      GiftCard.sum('initialBalance'),
      GiftCard.sum('balance')
    ]);
    const totalInitialVal = parseFloat(totalInitial || 0);
    const totalBalanceVal = parseFloat(totalBalance || 0);
    const giftCardByStatus = giftCardCounts.reduce((acc, row) => {
      acc[row.status] = { count: parseInt(row.count), totalInitial: parseFloat(row.totalInitial || 0), totalBalance: parseFloat(row.totalBalance || 0) };
      return acc;
    }, {});

    const supportTicketCounts = await SupportTicket.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });
    const openStatuses = ['open', 'in_progress', 'waiting'];
    const closedStatuses = ['resolved', 'closed'];
    const supportOpen = supportTicketCounts.filter(r => openStatuses.includes(r.status)).reduce((s, r) => s + parseInt(r.count), 0);
    const supportClosed = supportTicketCounts.filter(r => closedStatuses.includes(r.status)).reduce((s, r) => s + parseInt(r.count), 0);

    const refundRows = await Refund.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      where: { status: 'processed' },
      raw: true
    });
    const refundStats = refundRows[0] || { count: 0, totalAmount: 0 };

    const promoRows = await PromoCode.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('usage_count')), 'totalRedemptions']
      ],
      raw: true
    });
    const promoStats = promoRows[0] || { count: 0, totalRedemptions: 0 };

    res.json({
      users: {
        total: totalUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = parseInt(item.dataValues.count);
          return acc;
        }, {})
      },
      orders: {
        total: totalOrders,
        recentWeek: recentOrders,
        byStatus: ordersByStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.dataValues.count);
          return acc;
        }, {})
      },
      revenue: {
        total: parseFloat(totalRevenue)
      },
      restaurants: {
        total: totalRestaurants,
        featured: featuredRestaurants
      },
      giftCards: {
        totalIssuedValue: totalInitialVal,
        totalRedeemed: totalInitialVal - totalBalanceVal,
        totalOutstandingBalance: totalBalanceVal,
        count: giftCardTotalCount,
        byStatus: giftCardByStatus,
        countActive: giftCardByStatus.active?.count ?? 0,
        countUsed: giftCardByStatus.used?.count ?? 0,
        countVoid: giftCardByStatus.void?.count ?? 0
      },
      supportTickets: {
        total: supportOpen + supportClosed,
        open: supportOpen,
        closed: supportClosed
      },
      refunds: {
        count: parseInt(refundStats.count || 0),
        totalAmount: parseFloat(refundStats.totalAmount || 0)
      },
      promos: {
        totalCodes: parseInt(promoStats.count || 0),
        totalRedemptions: parseInt(promoStats.totalRedemptions || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch analytics'
    });
  }
});

router.get('/analytics/gift-cards', requireAdmin, async (req, res) => {
  try {
    const period = (req.query.period || 'monthly').toLowerCase();
    const now = new Date();
    const periods = [];

    if (period === 'weekly') {
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        weekStart.setDate(weekStart.getDate() + mondayOffset - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const result = await GiftCard.findAll({
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('initial_balance')), 'valueIssued']
          ],
          where: { createdAt: { [Op.gte]: weekStart, [Op.lte]: weekEnd } },
          raw: true
        });
        const row = result[0] || { count: 0, valueIssued: 0 };
        periods.push({
          period: `Week ${12 - i}`,
          label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          countIssued: parseInt(row.count, 10),
          valueIssued: parseFloat(row.valueIssued || 0)
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        const result = await GiftCard.findAll({
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('initial_balance')), 'valueIssued']
          ],
          where: { createdAt: { [Op.gte]: monthStart, [Op.lte]: monthEnd } },
          raw: true
        });
        const row = result[0] || { count: 0, valueIssued: 0 };
        periods.push({
          period: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          countIssued: parseInt(row.count, 10),
          valueIssued: parseFloat(row.valueIssued || 0)
        });
      }
    }

    const summary = await (async () => {
      const [totalCount, totalInitial, totalBalance] = await Promise.all([
        GiftCard.count(),
        GiftCard.sum('initialBalance'),
        GiftCard.sum('balance')
      ]);
      const ti = parseFloat(totalInitial || 0);
      const tb = parseFloat(totalBalance || 0);
      return {
        totalIssuedValue: ti,
        totalOutstandingBalance: tb,
        totalRedeemed: ti - tb,
        count: totalCount
      };
    })();

    res.json({ success: true, data: { byPeriod: periods, summary } });
  } catch (error) {
    console.error('Error fetching gift card analytics:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch gift card analytics' });
  }
});

router.post('/restaurants', requireAdmin, [
  body('id').notEmpty(),
  body('name').notEmpty(),
  body('address').notEmpty(),
  body('phone').notEmpty(),
  body('typeOfFood').notEmpty(),
  body('kosherCertification').notEmpty(),
  body('logoUrl').optional()
], async (req, res) => {
    console.log("Restaurant creation request body:", req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const restaurant = await Restaurant.create(req.body);

    try {
      await logAdminAction(
        req.user.id,
        'CREATE',
        'restaurants',
        restaurant.id,
        null,
        req.body,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for restaurant creation:', auditError);
    }

    try {
      await createGlobalAdminNotification({
        type: 'restaurant.created',
        title: 'New Restaurant Added',
        message: `Restaurant "${restaurant.name}" has been added to the platform`,
        ref: { kind: 'restaurant', id: restaurant.id, name: restaurant.name }
      });
    } catch (notifError) {
      logger.warn('Failed to create restaurant creation notification:', notifError);
    }

    res.status(201).json({
      success: true,
      data: restaurant,
      message: 'Restaurant created successfully'
    });

  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create restaurant'
    });
  }
});

router.put('/restaurants/:restaurantId', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const originalRestaurant = await Restaurant.findByPk(restaurantId);
    if (!originalRestaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }
    
    const [updatedRows] = await Restaurant.update(req.body, {
      where: { id: restaurantId },
      returning: true
    });

    if (updatedRows === 0) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const updatedRestaurant = await Restaurant.findByPk(restaurantId);

    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'restaurants',
        restaurantId,
        originalRestaurant.toJSON(),
        req.body,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for restaurant update:', auditError);
    }

    try {
      await createGlobalAdminNotification({
        type: 'restaurant.updated',
        title: 'Restaurant Updated',
        message: `Restaurant "${updatedRestaurant.name}" has been updated`,
        ref: { kind: 'restaurant', id: updatedRestaurant.id, name: updatedRestaurant.name }
      });
    } catch (notifError) {
      logger.warn('Failed to create restaurant update notification:', notifError);
    }

    res.json({
      success: true,
      data: updatedRestaurant,
      message: 'Restaurant updated successfully'
    });

  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update restaurant'
    });
  }
});

router.delete('/restaurants/:restaurantId', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurantToDelete = await Restaurant.findByPk(restaurantId);
    if (!restaurantToDelete) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const restaurantName = restaurantToDelete.name;

    await Order.update({ restaurantId: null }, { where: { restaurantId } });

    await UserRestaurantFavorite.destroy({ where: { restaurantId } });
    await MenuItem.destroy({ where: { restaurantId } });

    const deletedRows = await Restaurant.destroy({ where: { id: restaurantId }, force: true, individualHooks: false });

    if (deletedRows === 0) {
      const victim = await Restaurant.findOne({ where: { id: restaurantId }, paranoid: false });
      if (victim) {
        await victim.destroy({ force: true });
        
        try {
          await logAdminAction(
            req.user.id,
            'DELETE',
            'restaurants',
            restaurantId,
            restaurantToDelete.toJSON(),
            null,
            req
          );
        } catch (auditError) {
          logger.warn('Failed to log admin action for restaurant deletion:', auditError);
        }
        
        try {
          await createGlobalAdminNotification({
            type: 'restaurant.deleted',
            title: 'Restaurant Deleted',
            message: `Restaurant "${restaurantName}" has been deleted from the platform`,
            ref: { kind: 'restaurant', id: restaurantId, name: restaurantName }
          });
        } catch (notifError) {
          logger.warn('Failed to create restaurant deletion notification:', notifError);
        }
        
        return res.json({ success: true, message: 'Restaurant hard-deleted (was soft-deleted)' });
      }
      return res.status(404).json({ error: 'Restaurant not found', message: 'Restaurant does not exist' });
    }

    try {
      await logAdminAction(
        req.user.id,
        'DELETE',
        'restaurants',
        restaurantId,
        restaurantToDelete.toJSON(),
        null,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for restaurant deletion:', auditError);
    }

    try {
      await createGlobalAdminNotification({
        type: 'restaurant.deleted',
        title: 'Restaurant Deleted',
        message: `Restaurant "${restaurantName}" has been deleted from the platform`,
        ref: { kind: 'restaurant', id: restaurantId, name: restaurantName }
      });
    } catch (notifError) {
      logger.warn('Failed to create restaurant deletion notification:', notifError);
    }

    res.json({ success: true, message: 'Restaurant deleted successfully' });

  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to delete restaurant' });
  }
});

router.delete('/restaurants/by-name/:name', requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const victims = await Restaurant.findAll({ where: { name }, paranoid: false });
    let count = 0;
    for (const r of victims) {
      await Order.update({ restaurantId: null }, { where: { restaurantId: r.id } });
      await UserRestaurantFavorite.destroy({ where: { restaurantId: r.id } });
      await MenuItem.destroy({ where: { restaurantId: r.id } });
      await r.destroy({ force: true });
      count += 1;
    }
    res.json({ success: true, deleted: count });
  } catch (error) {
    console.error('Error deleting restaurant by name:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/restaurants/:restaurantId/menu-items', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { category, available, itemType, search, limit = 50, offset = 0 } = req.query;
    
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }
    
    const whereClause = { restaurantId };
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    if (available !== undefined) {
      whereClause.available = available === 'true';
    }
    
    if (itemType && itemType !== 'all') {
      whereClause.itemType = itemType;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const menuItems = await MenuItem.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name']
        }
      ]
    });
    
    const total = await MenuItem.count({ where: whereClause });
    
    const normalizedMenuItems = menuItems.map(item => {
      const normalized = item.toJSON();
      let labels = normalized.labels;
      if (typeof labels === 'string') {
        try { 
          labels = JSON.parse(labels); 
        } catch { 
          labels = []; 
        }
      }
      normalized.labels = labels;
      return normalized;
    });
    
    const totalPages = Math.ceil(total / parseInt(limit));
    const currentPage = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
    
    res.json({
      success: true,
      data: normalizedMenuItems,
      pagination: {
        page: currentPage,
        limit: parseInt(limit),
        total: total,
        totalPages: totalPages,
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch menu items'
    });
  }
});

router.get('/restaurants/:restaurantId/menu-items/:itemId', requireAdmin, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    
    const menuItem = await MenuItem.findOne({
      where: { 
        id: itemId,
        restaurantId 
      },
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name']
        }
      ]
    });
    
    if (!menuItem) {
      return res.status(404).json({
        error: 'Menu item not found',
        message: 'Menu item does not exist'
      });
    }
    
    const normalizedMenuItem = menuItem.toJSON();
    let labels = normalizedMenuItem.labels;
    if (typeof labels === 'string') {
      try { 
        labels = JSON.parse(labels); 
      } catch { 
        labels = []; 
      }
    }
    normalizedMenuItem.labels = labels;
    
    res.json({
      success: true,
      data: normalizedMenuItem
    });
    
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch menu item'
    });
  }
});

router.post('/restaurants/:restaurantId/menu-items', requireAdmin, [
  body('name').notEmpty().trim().isLength({ min: 1, max: 255 }),
  body('itemType').isIn(['simple', 'variety', 'builder']),
  body('price').custom((value) => {
    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue >= 0;
  }).withMessage('Price must be a valid number >= 0'),
  body('category').notEmpty().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('imageUrl').optional().custom((value) => {
    if (!value || value.trim() === '') return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }).withMessage('Image URL must be a valid URL'),
  body('available').optional().custom((value) => {
    return value === true || value === false || value === 'true' || value === 'false' || value === 1 || value === 0;
  }).withMessage('Available must be a boolean value'),
  body('options').optional().custom((value) => {
    return value === null || value === undefined || typeof value === 'object';
  }).withMessage('Options must be an object, null, or undefined'),
  body('labels').optional().custom((value) => {
    return value === null || value === undefined || Array.isArray(value);
  }).withMessage('Labels must be an array, null, or undefined'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { restaurantId } = req.params;
    
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }
    
    const validationErrors = validateMenuItemData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Menu item validation failed',
        details: validationErrors
      });
    }
    
    const normalizedData = normalizeMenuItemData(req.body);
    const menuItem = await MenuItem.create({
      ...normalizedData,
      restaurantId
    });
    
    await logAdminAction(
      req.user.id,
      'CREATE',
      'menu_items',
      menuItem.id,
      null,
      normalizedData,
      req
    );
    
    try {
      await createGlobalAdminNotification({
        type: 'menu_item.created',
        title: 'New Menu Item Added',
        message: `New menu item "${menuItem.name}" added to ${restaurant.name}`,
        ref: { 
          kind: 'menu_item', 
          id: menuItem.id, 
          name: menuItem.name,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name
        }
      });
    } catch (notifError) {
      logger.warn('Failed to create menu item notification:', notifError);
    }

    try {
      appEvents.emit('menu_item.created', {
        type: 'menu_item.created',
        title: 'New Menu Item Added',
        message: `New menu item "${menuItem.name}" added to ${restaurant.name}`,
        ref: { 
          kind: 'menu_item', 
          id: menuItem.id, 
          name: menuItem.name,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name
        },
        data: menuItem,
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      logger.warn('Failed to emit menu item creation SSE event:', sseError);
    }
    
    res.status(201).json({
      success: true,
      data: menuItem,
      message: 'Menu item created successfully'
    });
    
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create menu item'
    });
  }
});

router.put('/restaurants/:restaurantId/menu-items/:itemId', requireAdmin, [
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('itemType').optional().isIn(['simple', 'variety', 'builder']),
  body('price').optional().custom((value) => {
    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue >= 0;
  }).withMessage('Price must be a valid number >= 0'),
  body('category').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('imageUrl').optional().custom((value) => {
    if (!value || value.trim() === '') return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }).withMessage('Image URL must be a valid URL'),
  body('available').optional().custom((value) => {
    return value === true || value === false || value === 'true' || value === 'false' || value === 1 || value === 0;
  }).withMessage('Available must be a boolean value'),
  body('options').optional().custom((value) => {
    return value === null || value === undefined || typeof value === 'object';
  }).withMessage('Options must be an object, null, or undefined'),
  body('labels').optional().custom((value) => {
    return value === null || value === undefined || Array.isArray(value);
  }).withMessage('Labels must be an array, null, or undefined'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { restaurantId, itemId } = req.params;
    
    const existingItem = await MenuItem.findOne({
      where: { 
        id: itemId,
        restaurantId 
      },
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name']
        }
      ]
    });
    
    if (!existingItem) {
      return res.status(404).json({
        error: 'Menu item not found',
        message: 'Menu item does not exist'
      });
    }
    
    const mergedData = { ...existingItem.toJSON(), ...req.body };
    
    const validationErrors = validateMenuItemData(mergedData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Menu item validation failed',
        details: validationErrors
      });
    }
    
    const normalizedData = normalizeMenuItemData(mergedData);
    const oldValues = existingItem.toJSON();
    
    await existingItem.update(normalizedData);
    
    await logAdminAction(
      req.user.id,
      'UPDATE',
      'menu_items',
      itemId,
      oldValues,
      normalizedData,
      req
    );
    
    try {
      await createGlobalAdminNotification({
        type: 'menu_item.updated',
        title: 'Menu Item Updated',
        message: `Menu item "${existingItem.name}" in ${existingItem.restaurant.name} has been updated`,
        ref: { 
          kind: 'menu_item', 
          id: itemId, 
          name: existingItem.name,
          restaurantId: restaurantId,
          restaurantName: existingItem.restaurant.name
        }
      });
    } catch (notifError) {
      logger.warn('Failed to create menu item update notification:', notifError);
    }

    try {
      appEvents.emit('menu_item.updated', {
        type: 'menu_item.updated',
        title: 'Menu Item Updated',
        message: `Menu item "${existingItem.name}" in ${existingItem.restaurant.name} has been updated`,
        ref: { 
          kind: 'menu_item', 
          id: itemId, 
          name: existingItem.name,
          restaurantId: restaurantId,
          restaurantName: existingItem.restaurant.name
        },
        data: existingItem,
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      logger.warn('Failed to emit menu item update SSE event:', sseError);
    }
    
    res.json({
      success: true,
      data: existingItem,
      message: 'Menu item updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update menu item'
    });
  }
});

router.delete('/restaurants/:restaurantId/menu-items/:itemId', requireAdmin, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    
    const existingItem = await MenuItem.findOne({
      where: { 
        id: itemId,
        restaurantId 
      },
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name']
        }
      ]
    });
    
    if (!existingItem) {
      return res.status(404).json({
        error: 'Menu item not found',
        message: 'Menu item does not exist'
      });
    }
    
    const itemName = existingItem.name;
    const restaurantName = existingItem.restaurant.name;
    
    await existingItem.destroy();
    
    await logAdminAction(
      req.user.id,
      'DELETE',
      'menu_items',
      itemId,
      existingItem.toJSON(),
      null,
      req
    );
    
    try {
      await createGlobalAdminNotification({
        type: 'menu_item.deleted',
        title: 'Menu Item Deleted',
        message: `Menu item "${itemName}" from ${restaurantName} has been deleted`,
        ref: { 
          kind: 'menu_item', 
          id: itemId, 
          name: itemName,
          restaurantId: restaurantId,
          restaurantName: restaurantName
        }
      });
    } catch (notifError) {
      logger.warn('Failed to create menu item deletion notification:', notifError);
    }

    try {
      appEvents.emit('menu_item.deleted', {
        type: 'menu_item.deleted',
        title: 'Menu Item Deleted',
        message: `Menu item "${itemName}" from ${restaurantName} has been deleted`,
        ref: { 
          kind: 'menu_item', 
          id: itemId, 
          name: itemName,
          restaurantId: restaurantId,
          restaurantName: restaurantName
        },
        data: { id: itemId, name: itemName, restaurantId, restaurantName },
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      logger.warn('Failed to emit menu item deletion SSE event:', sseError);
    }
    
    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete menu item'
    });
  }
});

router.patch('/restaurants/:restaurantId/menu-items/bulk', requireAdmin, [
  body('updates').isArray().isLength({ min: 1 }),
  body('updates.*.id').isUUID(),
  body('updates.*.changes').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { restaurantId } = req.params;
    const { updates } = req.body;
    
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }
    
    const results = [];
    
    for (const update of updates) {
      try {
        const menuItem = await MenuItem.findOne({
          where: { 
            id: update.id,
            restaurantId 
          }
        });
        
        if (!menuItem) {
          results.push({ id: update.id, success: false, error: 'Menu item not found' });
          continue;
        }
        
        const oldValues = menuItem.toJSON();
        await menuItem.update(update.changes);
        
        await logAdminAction(
          req.user.id,
          'UPDATE',
          'menu_items',
          update.id,
          oldValues,
          update.changes,
          req
        );
        
        results.push({ id: update.id, success: true });
        
      } catch (itemError) {
        console.error(`Error updating menu item ${update.id}:`, itemError);
        results.push({ id: update.id, success: false, error: itemError.message });
      }
    }
    
    res.json({
      success: true,
      results,
      message: 'Bulk update completed'
    });
    
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to perform bulk update'
    });
  }
});


router.get('/menu-updates/stream', requireAdmin, async (req, res) => {
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Menu updates stream connected' })}\n\n`);

    const menuUpdateHandler = (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.error('Error sending SSE data:', error);
      }
    };

    appEvents.on('menu_item.created', menuUpdateHandler);
    appEvents.on('menu_item.updated', menuUpdateHandler);
    appEvents.on('menu_item.deleted', menuUpdateHandler);

    req.on('close', () => {
      appEvents.off('menu_item.created', menuUpdateHandler);
      appEvents.off('menu_item.updated', menuUpdateHandler);
      appEvents.off('menu_item.deleted', menuUpdateHandler);
    });

    const pingInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      } catch (pingError) {
        console.warn('Error sending ping:', pingError);
        clearInterval(pingInterval);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(pingInterval);
    });

  } catch (error) {
    console.error('Error setting up menu updates stream:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to establish menu updates stream'
    });
  }
});

router.get('/public/menu-updates/stream', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({
        error: 'Restaurant ID required',
        message: 'restaurantId query parameter is required'
      });
    }

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    res.write(`data: ${JSON.stringify({ 
      type: 'connected', 
      message: 'Menu updates stream connected',
      restaurantId: restaurantId 
    })}\n\n`);

    const menuUpdateHandler = (data) => {
      try {
        if (data.ref && data.ref.restaurantId === restaurantId) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (sseError) {
        console.error('Error sending SSE data:', sseError);
      }
    };

    appEvents.on('menu_item.created', menuUpdateHandler);
    appEvents.on('menu_item.updated', menuUpdateHandler);
    appEvents.on('menu_item.deleted', menuUpdateHandler);

    req.on('close', () => {
      appEvents.off('menu_item.created', menuUpdateHandler);
      appEvents.off('menu_item.updated', menuUpdateHandler);
      appEvents.off('menu_item.deleted', menuUpdateHandler);
    });

    const pingInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      } catch (pingError) {
        console.warn('Error sending ping:', pingError);
        clearInterval(pingInterval);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(pingInterval);
    });

  } catch (error) {
    console.error('Error setting up public menu updates stream:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to establish menu updates stream'
    });
  }
});

router.get('/delivery-zones', requireAdmin, async (req, res) => {
  try {
    const deliveryZones = await DeliveryZone.findAll({
      order: [['state', 'ASC'], ['city', 'ASC'], ['zipCode', 'ASC']]
    });

    res.json(deliveryZones);
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch delivery zones'
    });
  }
});

router.post('/delivery-zones', requireAdmin, [
  body('zipCode').notEmpty(),
  body('city').notEmpty(),
  body('state').notEmpty(),
  body('deliveryFee').isNumeric()
], async (req, res) => {
    console.log("Restaurant creation request body:", req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const deliveryZone = await DeliveryZone.create(req.body);

    try {
      await logAdminAction(
        req.user.id,
        'CREATE',
        'delivery_zones',
        deliveryZone.id,
        null,
        req.body,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for delivery zone creation:', auditError);
    }

    res.status(201).json({
      success: true,
      data: deliveryZone,
      message: 'Delivery zone created successfully'
    });

  } catch (error) {
    console.error('Error creating delivery zone:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create delivery zone'
    });
  }
});

router.put('/delivery-zones/:zoneId', requireAdmin, async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const originalZone = await DeliveryZone.findByPk(zoneId);
    if (!originalZone) {
      return res.status(404).json({
        error: 'Delivery zone not found',
        message: 'Delivery zone does not exist'
      });
    }
    
    const [updatedRows] = await DeliveryZone.update(req.body, {
      where: { id: zoneId },
      returning: true
    });

    if (updatedRows === 0) {
      return res.status(404).json({
        error: 'Delivery zone not found',
        message: 'Delivery zone does not exist'
      });
    }

    const updatedZone = await DeliveryZone.findByPk(zoneId);

    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'delivery_zones',
        zoneId,
        originalZone.toJSON(),
        req.body,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for delivery zone update:', auditError);
    }

    res.json({
      success: true,
      data: updatedZone,
      message: 'Delivery zone updated successfully'
    });

  } catch (error) {
    console.error('Error updating delivery zone:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update delivery zone'
    });
  }
});

router.get('/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case '7d':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '30d':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '90d':
        startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      default:
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    }

    const orders = await Order.findAll({
      where: {
        createdAt: { [Op.gte]: startDate }
      }
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const totalUsers = await Profile.count();
    const totalRestaurants = await Restaurant.count({
      where: { 
        active: true,
        deletedAt: null
      }
    });

    const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const previousOrders = await Order.findAll({
      where: {
        createdAt: { 
          [Op.gte]: previousPeriodStart,
          [Op.lt]: startDate
        }
      }
    });

    const previousRevenue = previousOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth = previousOrders.length > 0 ? ((totalOrders - previousOrders.length) / previousOrders.length) * 100 : 0;

    res.json({
      totalOrders,
      totalRevenue,
      totalUsers,
      totalRestaurants,
      averageOrderValue,
      ordersGrowth,
      revenueGrowth,
      usersGrowth: 0
    });

  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch dashboard stats'
    });
  }
});

router.get('/orders/recent', requireAdmin, async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    const whereClause = {};
    
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        dateFilter[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        dateFilter[Op.lte] = new Date(endDate);
      }
      whereClause.createdAt = dateFilter;
    }

    const orders = await Order.findAll({
      where: whereClause,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Profile,
          as: 'user',
          attributes: ['firstName', 'lastName']
        },
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['name']
        }
      ]
    });

    const formattedOrders = orders.map(order => ({
      id: order.orderNumber || order.id,
      customer: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Guest',
      restaurant: order.restaurant?.name || 'Unknown Restaurant',
      amount: parseFloat(order.total || 0),
      status: order.status,
      time: getRelativeTime(order.createdAt)
    }));

    res.json(formattedOrders);

  } catch (error) {
    logger.error('Error fetching recent orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch recent orders'
    });
  }
});

router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { 
      status, 
      dateRange, 
      startDate: queryStartDate,
      endDate: queryEndDate,
      restaurant, 
      search, 
      page = 1, 
      limit = 20 
    } = req.query;

    const whereClause = {};
    const include = [
      {
        model: Profile,
        as: 'user',
        attributes: ['firstName', 'lastName', 'email']
      },
      {
        model: Restaurant,
        as: 'restaurant',
        attributes: ['name']
      },
      {
        model: GiftCard,
        as: 'giftCards',
        attributes: ['id', 'code', 'initialBalance', 'balance', 'status'],
        required: false
      }
    ];

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (restaurant) {
      whereClause.restaurantId = restaurant;
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          break;
        case 'month':
          startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
      }
      
      if (startDate) {
        whereClause.createdAt = { [Op.gte]: startDate };
      }
    }

    if (queryStartDate || queryEndDate) {
      const dateFilter = {};
      if (queryStartDate) {
        dateFilter[Op.gte] = new Date(queryStartDate);
      }
      if (queryEndDate) {
        dateFilter[Op.lte] = new Date(queryEndDate);
      }
      whereClause.createdAt = dateFilter;
    }

    if (search) {
      whereClause[Op.or] = [
        { orderNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Order.findAndCountAll({
      where: whereClause,
      include,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

const enhancedOrders = await Promise.all(rows.map(async (order) => {
      const orderData = order.toJSON();

      if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
        const restaurantIds = Object.keys(orderData.restaurantGroups);
        const restaurants = await Restaurant.findAll({
          where: { id: restaurantIds },
          attributes: ['id', 'name', 'address', 'phone']
        });
        orderData.restaurants = restaurants;
        if (restaurantIds.includes('mkd-gift-cards') && !restaurants.some(r => r.id === 'mkd-gift-cards')) {
          orderData.restaurants.push({ id: 'mkd-gift-cards', name: 'Gift card purchase', address: null, phone: null });
        }
        orderData.isMultiRestaurant = restaurants.length > 1;
      } else if (orderData.restaurant) {
        orderData.restaurants = [orderData.restaurant];
        orderData.isMultiRestaurant = false;
      }

      return orderData;
    }));

    res.json({
      data: enhancedOrders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch orders'
    });
  }
});

function formatAddressForExport(deliveryAddress) {
  if (!deliveryAddress) return '—';
  const parts = [];
  const street = deliveryAddress.street || deliveryAddress.address || deliveryAddress.line1 || '';
  const apartment = deliveryAddress.apartment || deliveryAddress.unit || '';
  const limitedApartment = apartment ? String(apartment).substring(0, 20) : '';
  const city = deliveryAddress.city || '';
  const state = deliveryAddress.state || '';
  const zip = deliveryAddress.zip_code || deliveryAddress.zipCode || deliveryAddress.postal_code || '';
  if (street) {
    parts.push(limitedApartment ? `${street}, ${limitedApartment}` : street);
  }
  if (city || state || zip) parts.push([city, state, zip].filter(Boolean).join(', '));
  return parts.length ? parts.join('\n') : '—';
}

function formatItemDetailsForExport(item) {
  let details = item.name || 'Unknown Item';
  const variant = item.selectedVariant || item.variant || item.type;
  if (variant) {
    const variantName = variant.name || (typeof variant === 'string' ? variant : null);
    if (variantName) details += ` - ${variantName}`;
  }
  const configs = item.selectedConfigurations || item.configurations || item.config || item.selections;
  if (configs && (Array.isArray(configs) ? configs.length : Object.keys(configs || {}).length)) {
    const configStrings = Array.isArray(configs)
      ? configs.map(c => (c && c.option ? `${c.category}: ${c.option}` : (c && c.name ? c.name : String(c)))).filter(Boolean)
      : Object.entries(configs).map(([k, v]) => (v && v.option ? `${v.category}: ${v.option}` : `${k}: ${String(v)}`)).filter(Boolean);
    if (configStrings.length) details += ` (${configStrings.join(', ')})`;
  }
  return details;
}

function getRestaurantNameForItemExport(order, item) {
  if (item.restaurantName) return item.restaurantName;
  const rid = item.restaurantId || (order.restaurant && order.restaurant.id);
  if (order.restaurants && Array.isArray(order.restaurants)) {
    const r = order.restaurants.find(x => String(x.id) === String(rid));
    if (r) return r.name;
  }
  if (order.restaurant && String(order.restaurant.id) === String(rid)) return order.restaurant.name;
  if (order.restaurantGroups && typeof order.restaurantGroups === 'object') {
    for (const rId of Object.keys(order.restaurantGroups)) {
      if (String(rId) === String(rid)) {
        const rest = order.restaurants && order.restaurants.find(x => String(x.id) === String(rId));
        return rest ? rest.name : 'Unknown Restaurant';
      }
    }
  }
  return 'Unknown Restaurant';
}

router.get('/orders/export/individual', requireAdmin, async (req, res) => {
  try {
    const { startDate: startParam, endDate: endParam } = req.query;
    const startDate = startParam ? new Date(startParam) : null;
    const endDate = endParam ? new Date(endParam) : null;
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'startDate and endDate query params required (ISO)' });
    }
    const whereClause = { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } };
    const include = [
      { model: Profile, as: 'user', attributes: ['firstName', 'lastName', 'email'] },
      { model: Restaurant, as: 'restaurant', attributes: ['name'] }
    ];
    const rows = await Order.findAll({
      where: whereClause,
      include,
      order: [['createdAt', 'ASC']],
      limit: 10000
    });
    const enhancedOrders = await Promise.all(rows.map(async (order) => {
      const orderData = order.toJSON();
      if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
        const restaurantIds = Object.keys(orderData.restaurantGroups);
        const restaurants = await Restaurant.findAll({ where: { id: restaurantIds }, attributes: ['id', 'name'] });
        orderData.restaurants = restaurants;
      } else if (orderData.restaurant) {
        orderData.restaurants = [orderData.restaurant];
      }
      return orderData;
    }));

    const exportData = [];
    enhancedOrders.forEach(order => {
      const lastName = order.user?.lastName || order.guestInfo?.lastName || 'Unknown';
      let allItems = [];
      if (order.restaurantGroups) {
        Object.entries(order.restaurantGroups).forEach(([, group]) => {
          const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
          groupItems.forEach(item => {
            allItems.push({ ...item, restaurantName: getRestaurantNameForItemExport(order, item) });
          });
        });
      } else if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          allItems.push({ ...item, restaurantName: getRestaurantNameForItemExport(order, item) });
        });
      }
      const formattedAddress = formatAddressForExport(order.deliveryAddress || order.delivery_address);
      allItems.forEach((item, index) => {
        exportData.push({
          'Last Name': index === 0 ? lastName : '',
          'Qty/Item': `${item.quantity || 1}x ${formatItemDetailsForExport(item)} (${item.restaurantName})`,
          'Address': index === 0 ? formattedAddress : ''
        });
      });
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Orders');
    const headers = exportData.length ? Object.keys(exportData[0]) : ['Last Name', 'Qty/Item', 'Address'];
    ws.addRow(headers);
    exportData.forEach(row => ws.addRow(headers.map(h => row[h])));
    const buffer = await wb.xlsx.writeBuffer();
    const filename = `orders_individual_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Error exporting orders (individual):', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to export orders' });
  }
});

router.get('/orders/export/totalled', requireAdmin, async (req, res) => {
  try {
    const { startDate: startParam, endDate: endParam } = req.query;
    const startDate = startParam ? new Date(startParam) : null;
    const endDate = endParam ? new Date(endParam) : null;
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'startDate and endDate query params required (ISO)' });
    }
    const whereClause = { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } };
    const include = [
      { model: Profile, as: 'user', attributes: ['firstName', 'lastName'] },
      { model: Restaurant, as: 'restaurant', attributes: ['name'] }
    ];
    const rows = await Order.findAll({
      where: whereClause,
      include,
      order: [['createdAt', 'ASC']],
      limit: 10000
    });
    const enhancedOrders = await Promise.all(rows.map(async (order) => {
      const orderData = order.toJSON();
      if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
        const restaurantIds = Object.keys(orderData.restaurantGroups);
        const restaurants = await Restaurant.findAll({ where: { id: restaurantIds }, attributes: ['id', 'name'] });
        orderData.restaurants = restaurants;
      } else if (orderData.restaurant) {
        orderData.restaurants = [orderData.restaurant];
      }
      return orderData;
    }));

    const restaurantTotals = {};
    enhancedOrders.forEach(order => {
      let allItems = [];
      if (order.restaurantGroups) {
        Object.entries(order.restaurantGroups).forEach(([rId, group]) => {
          const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
          groupItems.forEach(item => {
            const withRest = { ...item, restaurantId: rId, restaurantName: getRestaurantNameForItemExport(order, { ...item, restaurantId: rId }) };
            allItems.push(withRest);
          });
        });
      } else if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          allItems.push({ ...item, restaurantName: getRestaurantNameForItemExport(order, item) });
        });
      }
      allItems.forEach(item => {
        const restaurantName = item.restaurantName || 'Unknown Restaurant';
        const itemDetails = formatItemDetailsForExport(item);
        const itemKey = `${restaurantName}|||${itemDetails}`;
        if (!restaurantTotals[itemKey]) {
          restaurantTotals[itemKey] = { restaurant: restaurantName, item: itemDetails, quantity: 0 };
        }
        restaurantTotals[itemKey].quantity += item.quantity || 1;
      });
    });

    const restaurantGroups = {};
    Object.values(restaurantTotals).forEach(entry => {
      if (!restaurantGroups[entry.restaurant]) restaurantGroups[entry.restaurant] = [];
      restaurantGroups[entry.restaurant].push(`${entry.quantity}x ${entry.item}`);
    });
    const exportData = Object.entries(restaurantGroups).map(([restaurant, items]) => ({
      'Restaurant': restaurant,
      'Items': items.join('\n')
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Totals');
    const headers = exportData.length ? Object.keys(exportData[0]) : ['Restaurant', 'Items'];
    ws.addRow(headers);
    exportData.forEach(row => ws.addRow(headers.map(h => row[h])));
    const buffer = await wb.xlsx.writeBuffer();
    const filename = `orders_totalled_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Error exporting orders (totalled):', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to export totalled orders' });
  }
});

router.get('/orders/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Profile,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        },
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
        },
        {
          model: GiftCard,
          as: 'giftCards',
          attributes: ['id', 'code', 'initialBalance', 'balance', 'status'],
          required: false
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    const orderData = order.toJSON();

    if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
      const restaurantIds = Object.keys(orderData.restaurantGroups);
      const restaurants = await Restaurant.findAll({
        where: { id: restaurantIds },
        attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
      });
      orderData.restaurants = restaurants;
      if (restaurantIds.includes('mkd-gift-cards') && !restaurants.some(r => r.id === 'mkd-gift-cards')) {
        orderData.restaurants.push({ id: 'mkd-gift-cards', name: 'Gift card purchase', address: null, phone: null, logoUrl: null });
      }
      orderData.isMultiRestaurant = orderData.restaurants.length > 1;
    } else if (orderData.restaurant) {
      orderData.restaurants = [orderData.restaurant];
      orderData.isMultiRestaurant = false;
    }

    res.json(orderData);
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order'
    });
  }
});

router.get('/restaurants/:restaurantId/menu', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { category, available = true, search } = req.query;

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const whereClause = { restaurantId };
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    if (available !== undefined) {
      whereClause.available = available === 'true';
    }
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const menuItems = await MenuItem.findAll({
      where: whereClause,
      include: [
        {
          model: MenuItemOption,
          as: 'itemOptions',
          attributes: ['id', 'optionName', 'optionType', 'required', 'options']
        }
      ],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    const groupedItems = menuItems.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name
        },
        menuItems: groupedItems,
        categories: Object.keys(groupedItems).sort()
      }
    });
  } catch (error) {
    logger.error('Error fetching restaurant menu:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch restaurant menu'
    });
  }
});

router.get('/menu-items', requireAdmin, async (req, res) => {
  try {
    const { restaurantId, category, available, search, page = 1, limit = 50 } = req.query;
    const searchTerm = search ? search.trim() : null;

    const whereClause = {};
    
    if (restaurantId) {
      whereClause.restaurantId = restaurantId;
    }
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    if (available !== undefined && available !== 'all') {
      whereClause.available = available === 'true' || available === true;
    } else if (available === undefined && !searchTerm) {
      whereClause.available = true;
    }
    
    if (searchTerm) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${searchTerm}%` } },
        { description: { [Op.iLike]: `%${searchTerm}%` } },
        { category: { [Op.iLike]: `%${searchTerm}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await MenuItem.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name']
        },
        {
          model: MenuItemOption,
          as: 'itemOptions',
          attributes: ['id', 'optionName', 'optionType', 'required', 'options']
        }
      ],
      order: [['restaurantId', 'ASC'], ['category', 'ASC'], ['name', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching menu items:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch menu items'
    });
  }
});

router.put('/orders/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Profile,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
          required: false
        }
      ]
    });
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    const originalTotal = order.total;
    const originalDeliveryAddress = order.deliveryAddress;
    const addressChanged = updateData.deliveryAddress && 
      JSON.stringify(updateData.deliveryAddress) !== JSON.stringify(originalDeliveryAddress);
    
    delete updateData.total;

    await order.update(updateData);
    
    await order.reload({
      include: [
        {
          model: Profile,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
          required: false
        }
      ]
    });
    
    if (order.total !== originalTotal) {
      await order.update({ total: originalTotal });
    }

    if (addressChanged && order.shipdayOrderId) {
      try {
        const { updateShipdayOrder } = require('../services/shipdayService');
        const shipdayResult = await updateShipdayOrder(order.shipdayOrderId, order);
        
        if (shipdayResult.success) {
          logger.info('Order address synced to Shipday', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            shipdayOrderId: order.shipdayOrderId
          });
        } else {
          logger.warn('Failed to sync order address to Shipday (non-blocking):', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            shipdayOrderId: order.shipdayOrderId,
            error: shipdayResult.error
          });
        }
      } catch (shipdayError) {
        logger.error('Error syncing order address to Shipday (non-blocking):', shipdayError, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          shipdayOrderId: order.shipdayOrderId
        });
      }
    }

    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'orders',
        orderId,
        order.toJSON(),
        updateData,
        req
      );
    } catch (auditError) {
      logger.warn('Admin action logging failed:', auditError);
    }

    res.json({
      success: true,
      data: order,
      message: 'Order updated successfully'
    });
  } catch (error) {
    logger.error('Error updating order:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update order'
    });
  }
});

router.delete('/orders/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found', message: 'Order does not exist' });
    }
    
    const orderData = order.toJSON();
    
    await order.destroy();
    
    try {
      await logAdminAction(req.user.id, 'DELETE', 'orders', orderId, orderData, null, req);
    } catch (auditError) {
      logger.warn('Admin action logging failed:', auditError);
    }
    
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    logger.error('Error deleting order:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to delete order' });
  }
});

router.patch('/orders/:orderId/status', requireAdmin, [
  body('status').isIn(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'])
], async (req, res) => {
    console.log("Restaurant creation request body:", req.body);
  try {
    const { orderId } = req.params;
    const requestedStatus = req.body.status;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    const prev = order.status;
    await order.update({ status: requestedStatus });

    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'orders',
        orderId,
        { status: prev },
        { status: requestedStatus },
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for order status update:', auditError);
    }

    const humanize = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const actor = `${req.user?.firstName || 'Admin'} ${req.user?.lastName || ''}`.trim();
    try {
      await createGlobalAdminNotification({
        type: 'order.status_changed',
        title: `Order ${order.orderNumber || order.id} ${humanize(prev)} → ${humanize(requestedStatus)}`,
        message: `Updated by ${actor}`,
        ref: { kind: 'order', id: order.id }
      });
    } catch (err) { logger.warn('admin order.status_changed notification failed', err); }

    if (order.shipdayOrderId) {
      try {
        const { updateShipdayOrderStatus, cancelShipdayOrder } = require('../services/shipdayService');
        
        if (requestedStatus === 'cancelled') {
          const cancelResult = await cancelShipdayOrder(order.shipdayOrderId);
          if (cancelResult.success) {
            logger.info('Order cancelled in Shipday', {
              orderId: order.id,
              orderNumber: order.orderNumber,
              shipdayOrderId: order.shipdayOrderId
            });
          } else {
            logger.warn('Failed to cancel order in Shipday (non-blocking):', {
              orderId: order.id,
              error: cancelResult.error
            });
          }
        } else {
          const shipdayResult = await updateShipdayOrderStatus(order.shipdayOrderId, requestedStatus);
          
          if (shipdayResult.success) {
            logger.info('Order status synced to Shipday', {
              orderId: order.id,
              orderNumber: order.orderNumber,
              shipdayOrderId: order.shipdayOrderId,
              status: requestedStatus
            });
          } else {
            logger.warn('Failed to sync order status to Shipday (non-blocking):', {
              orderId: order.id,
              error: shipdayResult.error
            });
          }
        }
      } catch (shipdayError) {
        logger.error('Error syncing order status to Shipday (non-blocking):', shipdayError, {
          orderId: order.id
        });
      }
    }

    res.json({
      success: true,
      data: order,
      message: `Order status updated to ${requestedStatus}`
    });

  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update order status'
    });
  }
});

router.post('/orders/:orderId/refund', requireAdmin, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('reason').notEmpty().withMessage('Refund reason is required'),
  body('refundType').isIn(['full', 'partial']).withMessage('Refund type must be full or partial')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { orderId } = req.params;
    const { amount, reason, refundType } = req.body;
    const adminId = req.user.id;

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Profile,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    const orderTotal = parseFloat(order.total || 0);
    const refundAmount = parseFloat(amount);
    
    const existingRefunds = await Refund.findAll({
      where: { orderId: orderId, status: 'processed' }
    });
    const totalRefunded = existingRefunds.reduce((sum, refund) => sum + parseFloat(refund.amount), 0);
    const remainingRefundable = orderTotal - totalRefunded;
    
    if (refundType === 'full') {
      if (Math.abs(refundAmount - remainingRefundable) > 0.01) {
      return res.status(400).json({
        error: 'Invalid refund amount',
          message: `Full refund amount must match remaining refundable amount of ${remainingRefundable.toFixed(2)}`
      });
      }
    }

    if (refundAmount > remainingRefundable) {
      return res.status(400).json({
        error: 'Invalid refund amount',
        message: `Refund amount cannot exceed remaining refundable amount of ${remainingRefundable.toFixed(2)}`
      });
    }

    const stripeClient = stripe();
    if (!stripeClient) {
      return res.status(503).json({
        error: 'Payment provider not configured',
        message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment.'
      });
    }

    let paymentIntentId = order.stripePaymentIntentId || order.stripe_payment_intent_id;
    
    if (!paymentIntentId) {
      try {
        logger.info('Payment intent ID not found in order, searching Stripe...', { orderId });
        
        let matchingIntent = null;
        
        try {
          const paymentIntents = await stripeClient.paymentIntents.search({
            query: `metadata['orderIds']:'${orderId}'`,
            limit: 10
          });
          
          matchingIntent = paymentIntents.data.find(pi => {
            if (pi.status !== 'succeeded') return false;
            const orderIds = pi.metadata?.orderIds?.split(',') || [];
            return orderIds.includes(orderId);
          });
        } catch (searchError) {
          logger.warn('Stripe search API not available or failed, trying list method', {
            error: searchError.message
      });
    }

        if (!matchingIntent) {
          const orderDate = new Date(order.createdAt);
          const startDate = new Date(orderDate.getTime() - 48 * 60 * 60 * 1000);
          const endDate = new Date(orderDate.getTime() + 1 * 60 * 60 * 1000);
          
          const amountInCents = Math.round(orderTotal * 100);
          
          const paymentIntentsList = await stripeClient.paymentIntents.list({
            created: {
              gte: Math.floor(startDate.getTime() / 1000),
              lte: Math.floor(endDate.getTime() / 1000)
            },
            limit: 100
          });
          
          matchingIntent = paymentIntentsList.data.find(pi => {
            if (pi.status !== 'succeeded') return false;
            if (Math.abs(pi.amount - amountInCents) > 5) return false;
            const orderIds = pi.metadata?.orderIds?.split(',') || [];
            return orderIds.includes(orderId);
          });
        }
        
        if (matchingIntent) {
          paymentIntentId = matchingIntent.id;
          logger.info('Found payment intent from Stripe', { 
            orderId, 
            paymentIntentId,
            amount: matchingIntent.amount / 100,
            status: matchingIntent.status
          });
          
          try {
            const updateData = {};
            if (order.rawAttributes?.stripePaymentIntentId) {
              updateData.stripePaymentIntentId = paymentIntentId;
            } else if (order.rawAttributes?.stripe_payment_intent_id) {
              updateData.stripe_payment_intent_id = paymentIntentId;
            } else {
              updateData.stripePaymentIntentId = paymentIntentId;
            }
            await order.update(updateData);
            logger.info('Updated order with payment intent ID', { orderId, paymentIntentId });
          } catch (updateError) {
            logger.warn('Failed to update order with payment intent ID (field may not exist)', { 
              orderId, 
              paymentIntentId, 
              error: updateError.message 
            });
          }
        }
      } catch (stripeError) {
        logger.error('Error searching Stripe for payment intent', {
          orderId,
          error: stripeError.message,
          stack: stripeError.stack
        });
      }
    }
    
    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'No payment found',
        message: 'Could not find a Stripe payment intent for this order. The order may not have been paid through Stripe, or the payment intent could not be located.'
      });
    }


    const refundRecord = await Refund.create({
      orderId: orderId,
      amount: refundAmount,
      reason: reason,
      processedBy: adminId,
      status: 'pending'
    });

    try {
      const stripeRefund = await stripeClient.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: {
          orderId: orderId,
          refundId: refundRecord.id,
          processedBy: adminId,
          reason: reason
        }
      });

      await refundRecord.update({
        stripeRefundId: stripeRefund.id,
        status: 'processed'
      });

      if (refundType === 'full' || Math.abs(refundAmount - remainingRefundable) < 0.01) {
        await order.update({ status: 'cancelled' });
      }

      try {
        await logAdminAction(adminId, 'CREATE', 'refunds', refundRecord.id, null, {
          orderId: orderId,
          amount: refundAmount,
          reason: reason,
          stripeRefundId: stripeRefund.id
        }, req);
      } catch (auditError) {
        logger.warn('Admin action logging failed:', auditError);
      }

      logger.info('Refund processed successfully', {
        refundId: refundRecord.id,
        orderId: orderId,
        amount: refundAmount,
        stripeRefundId: stripeRefund.id,
        adminId: adminId
      });

      res.json({
        success: true,
        data: {
          refund: refundRecord.toJSON(),
          stripeRefund: {
            id: stripeRefund.id,
            status: stripeRefund.status,
            amount: stripeRefund.amount / 100
          }
        },
        message: 'Refund processed successfully'
      });
    } catch (stripeError) {
      await refundRecord.update({ status: 'failed' });

      logger.error('Stripe refund failed:', stripeError, {
        refundId: refundRecord.id,
        orderId: orderId,
        amount: refundAmount
      });

      return res.status(500).json({
        error: 'Refund processing failed',
        message: stripeError.message || 'Failed to process refund through Stripe'
      });
    }
  } catch (error) {
    logger.error('Error processing refund:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process refund'
    });
  }
});

router.get('/orders/:orderId/refunds', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const refunds = await Refund.findAll({
      where: { orderId: orderId },
      include: [
        {
          model: Profile,
          as: 'processor',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: refunds
    });
  } catch (error) {
    logger.error('Error fetching refunds:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch refunds'
    });
  }
});

router.get('/restaurants', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { typeOfFood: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Restaurant.findAndCountAll({
      where: whereClause,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching restaurants:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch restaurants'
    });
  }
});

router.patch('/restaurants/:restaurantId/featured', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const oldFeatured = restaurant.featured;
    await restaurant.update({ featured: !restaurant.featured });

    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'restaurants',
        restaurantId,
        { featured: oldFeatured },
        { featured: !oldFeatured },
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for restaurant featured toggle:', auditError);
    }

    res.json({
      success: true,
      data: restaurant,
      message: `Restaurant ${restaurant.featured ? 'featured' : 'unfeatured'} successfully`
    });

  } catch (error) {
    logger.error('Error toggling restaurant featured status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update restaurant'
    });
  }
});

router.post('/restaurants/logo/upload', requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.filename;
    
    try {
      const restaurantId = req.body.restaurantId;
      if (restaurantId) {
        await logAdminAction(
          req.user.id,
          'UPDATE',
          'restaurants',
          restaurantId,
          null,
          { logoUrl: filename },
          req
        );
      }
    } catch (auditError) {
      logger.warn('Failed to log admin action for logo upload:', auditError);
    }
    
    res.json({ success: true, filename });
  } catch (error) {
    logger.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications', requireAdmin, async (req, res) => {
  try {
    const { limit = 250, offset = 0 } = req.query;
    const items = await AdminNotification.findAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const allNotifications = await AdminNotification.findAll({
      order: [['createdAt', 'DESC']]
    });
    const unreadCount = allNotifications.filter(notif => 
      !notif.readBy.includes(req.user.id)
    ).length;
    
    res.json({ data: items, unreadCount });
  } catch (error) {
    logger.error('Error fetching admin notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/notifications/:id/read', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { read = true } = req.body || {};
    const notif = await AdminNotification.findByPk(id);
    if (!notif) return res.status(404).json({ error: 'Not found' });
    
    let updatedReadBy = [...notif.readBy];
    if (read && !updatedReadBy.includes(req.user.id)) {
      updatedReadBy.push(req.user.id);
    } else if (!read && updatedReadBy.includes(req.user.id)) {
      updatedReadBy = updatedReadBy.filter(id => id !== req.user.id);
    }
    
    await notif.update({ readBy: updatedReadBy });
    
    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'admin_notifications',
        id,
        { readBy: notif.readBy },
        { readBy: updatedReadBy },
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for notification read update:', auditError);
    }
    
    const allNotifications = await AdminNotification.findAll({
      order: [['createdAt', 'DESC']]
    });
    const unreadCount = allNotifications.filter(n => 
      !n.readBy.includes(req.user.id)
    ).length;
    
    res.json({ success: true, unreadCount });
  } catch (error) {
    logger.error('Error updating admin notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/notifications/read-all', requireAdmin, async (req, res) => {
  try {
    const allNotifications = await AdminNotification.findAll();
    const currentUserId = req.user.id;
    
    for (const notif of allNotifications) {
      if (!notif.readBy.includes(currentUserId)) {
        const oldReadBy = [...notif.readBy];
        const updatedReadBy = [...notif.readBy, currentUserId];
        await notif.update({ readBy: updatedReadBy });
        
        try {
          await logAdminAction(
            req.user.id,
            'UPDATE',
            'admin_notifications',
            notif.id,
            { readBy: oldReadBy },
            { readBy: updatedReadBy },
            req
          );
        } catch (auditError) {
          logger.warn('Failed to log admin action for notification read-all:', auditError);
        }
      }
    }
    
    res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    logger.error('Error marking all admin notifications read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/notifications/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await AdminNotification.findByPk(id);
    if (!notif) return res.status(404).json({ error: 'Not found' });
    
    try {
      await logAdminAction(
        req.user.id,
        'DELETE',
        'admin_notifications',
        id,
        notif.toJSON(),
        null,
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for notification deletion:', auditError);
    }
    
    await notif.destroy({ force: true });
    
    const allNotifications = await AdminNotification.findAll({
      order: [['createdAt', 'DESC']]
    });
    const unreadCount = allNotifications.filter(n => 
      !n.readBy.includes(req.user.id)
    ).length;
    
    res.json({ success: true, unreadCount });
  } catch (error) {
    logger.error('Error deleting admin notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/support/tickets', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await SupportTicket.findAndCountAll({
      where,
      include: [{ 
        model: Profile, 
        as: 'customer', 
        attributes: ['firstName', 'lastName', 'email'],
        required: false
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const data = rows.map(t => {
      let requester_name = '';
      let requester_email = '';
      
      if (t.customer) {
        requester_name = `${t.customer.firstName || ''} ${t.customer.lastName || ''}`.trim();
        requester_email = t.customer.email || '';
      } else {
        const messageLines = t.message.split('\n');
        const fromLine = messageLines.find(line => line.startsWith('From: '));
        if (fromLine) {
          const match = fromLine.match(/From: (.+?) \((.+?)\)/);
          if (match) {
            requester_name = match[1];
            requester_email = match[2];
          }
        }
      }

      return {
        id: t.id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        createdAt: t.createdAt,
        requester_name,
        requester_email,
        is_guest_ticket: !t.customer
      };
    });

    return res.json({
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching support tickets:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch support tickets' });
  }
});

router.patch('/support/tickets/:ticketId/status', requireAdmin, [
  body('status').isString()
], async (req, res) => {
    console.log("Restaurant creation request body:", req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { ticketId } = req.params;
    const requested = req.body.status;
    const prevDisplay = typeof req.body.prevDisplay === 'string' ? req.body.prevDisplay : null;
    let status = requested;
    
    if (!['open','in_progress','waiting','resolved','closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    
    const prev = ticket.status;
    
    await ticket.update({ status });
    
    try {
      await logAdminAction(
        req.user.id,
        'UPDATE',
        'support_tickets',
        ticketId,
        { status: prev },
        { status: status },
        req
      );
    } catch (auditError) {
      logger.error('Failed to log admin action for ticket status update:', auditError);
    }
    const humanize = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const displayNew = requested;
    const displayPrev = prevDisplay || prev;
    const actor = `${req.user?.firstName || 'Admin'} ${req.user?.lastName || ''}`.trim();
    await createGlobalAdminNotification({
      type: 'ticket.status_changed',
      title: `Ticket ${ticket.id.slice(0,8)} ${humanize(displayPrev)} → ${humanize(displayNew)}`,
      message: `Updated by ${actor}${ticket.subject ? ` — ${ticket.subject}` : ''}`,
      ref: { kind: 'ticket', id: ticket.id }
    });
    return res.json({ success: true, data: { id: ticket.id, status } });
  } catch (error) {
    logger.error('Error updating ticket status:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update status' });
  }
});

router.post('/support/tickets/:ticketId/responses', requireAdmin, [
  body('message').isString().isLength({ min: 1 }),
  body('isInternal').optional().isBoolean()
], async (req, res) => {
    console.log("Restaurant creation request body:", req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    const { ticketId } = req.params;
    const { message, isInternal = false } = req.body;
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const response = await TicketResponse.create({
      ticketId: ticket.id,
      responderId: req.user.id,
      message,
      isInternal
    });
    
    try {
      await logAdminAction(
        req.user.id,
        'CREATE',
        'ticket_responses',
        response.id,
        null,
        { ticketId: ticket.id, message, isInternal },
        req
      );
    } catch (auditError) {
      logger.warn('Failed to log admin action for ticket response creation:', auditError);
    }
    
    return res.status(201).json({ success: true, data: { id: response.id } });
  } catch (error) {
    logger.error('Error adding ticket response:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to add response' });
  }
});

router.delete('/support/tickets/closed', requireAdmin, async (req, res) => {
  try {
    const closedTickets = await SupportTicket.findAll({ 
      where: { status: 'closed' },
      attributes: ['id', 'subject', 'status', 'createdAt']
    });
    
    const count = await SupportTicket.destroy({ where: { status: 'closed' }, force: true });
    
    if (count > 0) {
      try {
        await logAdminAction(
          req.user.id,
          'DELETE',
          'support_tickets',
          'bulk_deletion',
          { 
            action: 'bulk_delete_closed_tickets',
            count: count,
            deletedTicketIds: closedTickets.map(ticket => ticket.id)
          },
          null,
          req
        );
      } catch (auditError) {
        logger.error('Failed to log admin action for bulk ticket deletion:', auditError);
      }
    }
    
    if (count > 0) {
      try {
        await createGlobalAdminNotification({
          type: 'tickets.bulk_deleted',
          title: 'Closed Tickets Deleted',
          message: `All ${count} closed support tickets have been permanently deleted`,
          ref: { kind: 'tickets', count, status: 'closed' }
        });
      } catch (notifError) {
        logger.warn('Failed to create closed tickets deletion notification:', notifError);
      }
    }
    
    return res.json({ success: true, deleted: count });
  } catch (error) {
    logger.error('Error deleting closed tickets:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete closed tickets' });
  }
});

const getRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

router.get('/support-tickets', requireAdmin, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    
    const whereClause = {};
    
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      whereClause.status = { [Op.in]: statuses };
    }
    
    if (priority) {
      whereClause.priority = priority;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await SupportTicket.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Profile,
          as: 'customer',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Profile,
          as: 'assignedAdmin',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        hasNext: offset + parseInt(limit) < count,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch support tickets'
    });
  }
});


router.get('/menu-change-requests', requireAdmin, async (req, res) => {
  try {
    const { status, changeType, page = 1, limit = 20 } = req.query;
    
    const whereClause = {};
    
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      whereClause.status = { [Op.in]: statuses };
    }
    
    if (changeType) {
      whereClause.changeType = changeType;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await MenuChangeRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name']
        },
        {
          model: Profile,
          as: 'requester',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Profile,
          as: 'approver',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        hasNext: offset + parseInt(limit) < count,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching menu change requests:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch menu change requests'
    });
  }
});


router.get('/requests/stream', requireAdmin, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const sendInitialCount = async () => {
    try {
      const [supportTicketsResp, menuRequestsResp] = await Promise.all([
        SupportTicket.count({ where: { status: { [Op.in]: ['open', 'in_progress'] } } }),
        MenuChangeRequest.count({ where: { status: 'pending' } })
      ]);
      
      const totalRequests = supportTicketsResp + menuRequestsResp;
      sendEvent('requests.count', { count: totalRequests });
    } catch (error) {
      console.error('Error sending initial requests count:', error);
    }
  };

  sendInitialCount();

  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\n');
    res.write('data: {}\n\n');
  }, 30000);

  const onSupportTicketCreated = (payload) => {
    if (payload.status === 'open' || payload.status === 'in_progress') {
      sendEvent('requests.count', { count: 'increment' });
    }
  };

  const onSupportTicketUpdated = () => {
    sendEvent('requests.count', { count: 'refresh' });
  };

  const onMenuRequestCreated = (payload) => {
    if (payload.status === 'pending') {
      sendEvent('requests.count', { count: 'increment' });
    }
  };

  const onMenuRequestUpdated = () => {
    sendEvent('requests.count', { count: 'refresh' });
  };

  appEvents.on('support_ticket.created', onSupportTicketCreated);
  appEvents.on('support_ticket.updated', onSupportTicketUpdated);
  appEvents.on('menu_change_request.created', onMenuRequestCreated);
  appEvents.on('menu_change_request.updated', onMenuRequestUpdated);

  req.on('close', () => {
    clearInterval(heartbeat);
    appEvents.off('support_ticket.created', onSupportTicketCreated);
    appEvents.off('support_ticket.updated', onSupportTicketUpdated);
    appEvents.off('menu_change_request.created', onMenuRequestCreated);
    appEvents.off('menu_change_request.updated', onMenuRequestUpdated);
    res.end();
  });
});

const mailchimpService = require('../services/mailchimpService');

router.get('/mailchimp/campaigns', requireAdmin, async (req, res) => {
  try {
    const { count = 10, offset = 0, status, type } = req.query;
    const campaigns = await mailchimpService.getCampaigns({ count, offset, status, type });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    logger.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/campaigns', requireAdmin, [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Campaign name is required and must be less than 255 characters'),
  body('subject').trim().isLength({ min: 1, max: 255 }).withMessage('Subject is required and must be less than 255 characters'),
  body('content').optional().isLength({ max: 100000 }).withMessage('Content must be less than 100KB'),
  body('fromEmail').optional().isEmail().withMessage('From email must be a valid email address'),
  body('listId').optional().isString(),
  body('segmentId').optional().isString(),
  body('scheduleTime').optional().isISO8601().withMessage('Schedule time must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const campaignData = req.body;
    const campaign = await mailchimpService.createCampaign(campaignData);
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to create campaign' : error.message });
  }
});

router.put('/mailchimp/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const campaignData = req.body;
    const campaign = await mailchimpService.updateCampaign(id, campaignData);
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error updating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/campaigns/:id/send', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await mailchimpService.sendCampaign(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error sending campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/mailchimp/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await mailchimpService.deleteCampaign(id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/campaigns/:id/analytics', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const analytics = await mailchimpService.getCampaignAnalytics(id);
    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('Error fetching campaign analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/campaigns/:id/test', requireAdmin, [
  body('test_emails').isArray({ min: 1, max: 5 }).withMessage('Test emails must be an array with 1-5 email addresses'),
  body('test_emails.*').isEmail().normalizeEmail().withMessage('All test emails must be valid email addresses')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { id } = req.params;
    const { test_emails } = req.body;
    const result = await mailchimpService.sendTestEmail(id, test_emails);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error sending test email:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to send test email' : error.message });
  }
});

router.get('/mailchimp/templates', requireAdmin, async (req, res) => {
  try {
    const { count = 10, offset = 0 } = req.query;
    const templates = await mailchimpService.getTemplates({ count, offset });
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/templates', requireAdmin, [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Template name is required and must be less than 255 characters'),
  body('content').optional().isLength({ max: 100000 }).withMessage('Content must be less than 100KB')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const templateData = req.body;
    const template = await mailchimpService.createTemplate(templateData);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to create template' : error.message });
  }
});

router.put('/mailchimp/templates/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const templateData = req.body;
    const template = await mailchimpService.updateTemplate(id, templateData);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/mailchimp/templates/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await mailchimpService.deleteTemplate(id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/lists', requireAdmin, async (req, res) => {
  try {
    const lists = await mailchimpService.getLists();
    res.json({ success: true, data: lists });
  } catch (error) {
    logger.error('Error fetching lists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/lists/:id/members', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { count = 10, offset = 0, status } = req.query;
    const members = await mailchimpService.getListMembers(id, { count, offset, status });
    res.json({ success: true, data: members });
  } catch (error) {
    logger.error('Error fetching list members:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/lists/:id/members', requireAdmin, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('status').optional().isIn(['subscribed', 'unsubscribed', 'cleaned', 'pending']).withMessage('Invalid status'),
  body('mergeFields').optional().isObject().withMessage('Merge fields must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { id } = req.params;
    const memberData = req.body;
    const member = await mailchimpService.addListMember(id, memberData);
    res.json({ success: true, data: member });
  } catch (error) {
    logger.error('Error adding list member:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to add member' : error.message });
  }
});

router.put('/mailchimp/lists/:id/members/:email', requireAdmin, [
  param('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('status').optional().isIn(['subscribed', 'unsubscribed', 'cleaned', 'pending']).withMessage('Invalid status'),
  body('mergeFields').optional().isObject().withMessage('Merge fields must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { id, email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    if (!decodedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    const memberData = req.body;
    const member = await mailchimpService.updateListMember(id, decodedEmail, memberData);
    res.json({ success: true, data: member });
  } catch (error) {
    logger.error('Error updating list member:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to update member' : error.message });
  }
});

router.delete('/mailchimp/lists/:id/members/:email', requireAdmin, [
  param('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { id, email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    if (!decodedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    await mailchimpService.removeListMember(id, decodedEmail);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing list member:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to remove member' : error.message });
  }
});

router.get('/mailchimp/account', requireAdmin, async (req, res) => {
  try {
    const accountInfo = await mailchimpService.getAccountInfo();
    res.json({ success: true, data: accountInfo });
  } catch (error) {
    logger.error('Error fetching account info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/lists/:listId/segments', requireAdmin, async (req, res) => {
  try {
    const { listId } = req.params;
    const { count, offset, type } = req.query;
    const segments = await mailchimpService.getSegments(listId, { count, offset, type });
    res.json({ success: true, data: segments });
  } catch (error) {
    logger.error('Error fetching segments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/lists/:listId/segments', requireAdmin, [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Segment name is required and must be less than 255 characters'),
  body('type').isIn(['static', 'saved']).withMessage('Segment type must be static or saved'),
  body('conditions').optional().isArray().withMessage('Conditions must be an array'),
  body('staticSegment').optional().isArray().withMessage('Static segment must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { listId } = req.params;
    const segmentData = req.body;
    const segment = await mailchimpService.createSegment(listId, segmentData);
    res.json({ success: true, data: segment });
  } catch (error) {
    logger.error('Error creating segment:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to create segment' : error.message });
  }
});

router.put('/mailchimp/lists/:listId/segments/:segmentId', requireAdmin, async (req, res) => {
  try {
    const { listId, segmentId } = req.params;
    const segmentData = req.body;
    const segment = await mailchimpService.updateSegment(listId, segmentId, segmentData);
    res.json({ success: true, data: segment });
  } catch (error) {
    logger.error('Error updating segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/mailchimp/lists/:listId/segments/:segmentId', requireAdmin, async (req, res) => {
  try {
    const { listId, segmentId } = req.params;
    await mailchimpService.deleteSegment(listId, segmentId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/lists/:listId/segments/:segmentId/members', requireAdmin, [
  body('emails').isArray({ min: 1, max: 1000 }).withMessage('Emails must be an array with 1-1000 items'),
  body('emails.*').isEmail().normalizeEmail().withMessage('All emails must be valid email addresses')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { listId, segmentId } = req.params;
    const { emails } = req.body;
    const result = await mailchimpService.addSegmentMembers(listId, segmentId, emails);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error adding segment members:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to add segment members' : error.message });
  }
});

router.get('/mailchimp/lists/:listId/members/:email/tags', requireAdmin, [
  param('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { listId, email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    if (!decodedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    const crypto = require('crypto');
    const subscriberHash = crypto.createHash('md5').update(decodedEmail.toLowerCase()).digest('hex');
    const tags = await mailchimpService.getMemberTags(listId, subscriberHash);
    res.json({ success: true, data: tags });
  } catch (error) {
    logger.error('Error fetching member tags:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to fetch tags' : error.message });
  }
});

router.post('/mailchimp/lists/:listId/members/:email/tags', requireAdmin, [
  param('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('tags').isArray({ min: 1, max: 50 }).withMessage('Tags must be an array with 1-50 items'),
  body('tags.*').trim().isLength({ min: 1, max: 100 }).withMessage('Each tag must be 1-100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { listId, email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    if (!decodedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    const { tags } = req.body;
    const crypto = require('crypto');
    const subscriberHash = crypto.createHash('md5').update(decodedEmail.toLowerCase()).digest('hex');
    const result = await mailchimpService.addMemberTags(listId, subscriberHash, tags);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error adding member tags:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to add tags' : error.message });
  }
});

router.delete('/mailchimp/lists/:listId/members/:email/tags', requireAdmin, [
  param('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('tags').isArray({ min: 1, max: 50 }).withMessage('Tags must be an array with 1-50 items'),
  body('tags.*').trim().isLength({ min: 1, max: 100 }).withMessage('Each tag must be 1-100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { listId, email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    if (!decodedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    const { tags } = req.body;
    const crypto = require('crypto');
    const subscriberHash = crypto.createHash('md5').update(decodedEmail.toLowerCase()).digest('hex');
    const result = await mailchimpService.removeMemberTags(listId, subscriberHash, tags);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error removing member tags:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to remove tags' : error.message });
  }
});

router.get('/mailchimp/lists/:listId/tags', requireAdmin, async (req, res) => {
  try {
    const { listId } = req.params;
    const tags = await mailchimpService.getAllTags(listId);
    res.json({ success: true, data: tags });
  } catch (error) {
    logger.error('Error fetching tags:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const customerSyncService = require('../services/customerSyncService');

router.post('/mailchimp/sync/customer/:userId', requireAdmin, [
  param('userId').isUUID().withMessage('User ID must be a valid UUID'),
  body('listId').optional().isString().withMessage('List ID must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { userId } = req.params;
    const { listId } = req.body;
    
    if (!listId) {
      const defaultListId = await customerSyncService.getOrCreateDefaultList();
      const result = await customerSyncService.syncCustomerToMailChimp(userId, defaultListId);
      res.json({ success: true, data: result });
    } else {
      const result = await customerSyncService.syncCustomerToMailChimp(userId, listId);
      res.json({ success: true, data: result });
    }
  } catch (error) {
    logger.error('Error syncing customer:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to sync customer' : error.message });
  }
});

router.post('/mailchimp/sync/batch', requireAdmin, [
  body('listId').optional().isString().withMessage('List ID must be a string'),
  body('userIds').optional().isArray({ max: 1000 }).withMessage('User IDs must be an array with max 1000 items'),
  body('userIds.*').optional().isUUID().withMessage('All user IDs must be valid UUIDs'),
  body('batchSize').optional().isInt({ min: 1, max: 100 }).withMessage('Batch size must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { listId, userIds, batchSize = 50 } = req.body;
    const safeBatchSize = Math.min(Math.max(1, parseInt(batchSize) || 50), 100);
    
    if (!listId) {
      const defaultListId = await customerSyncService.getOrCreateDefaultList();
      const result = await customerSyncService.batchSyncCustomers(defaultListId, userIds, safeBatchSize);
      res.json({ success: true, data: result });
    } else {
      const result = await customerSyncService.batchSyncCustomers(listId, userIds, safeBatchSize);
      res.json({ success: true, data: result });
    }
  } catch (error) {
    logger.error('Error batch syncing customers:', error);
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Failed to sync customers' : error.message });
  }
});

router.get('/mailchimp/automations', requireAdmin, async (req, res) => {
  try {
    const { count, offset } = req.query;
    const automations = await mailchimpService.getAutomations({ count, offset });
    res.json({ success: true, data: automations });
  } catch (error) {
    logger.error('Error fetching automations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/automations/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const automation = await mailchimpService.getAutomation(id);
    res.json({ success: true, data: automation });
  } catch (error) {
    logger.error('Error fetching automation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/automations/:id/start', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await mailchimpService.startAutomation(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error starting automation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mailchimp/automations/:id/pause', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await mailchimpService.pauseAutomation(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error pausing automation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/automations/:id/emails', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const emails = await mailchimpService.getAutomationEmails(id);
    res.json({ success: true, data: emails });
  } catch (error) {
    logger.error('Error fetching automation emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/campaigns/:id/report', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await mailchimpService.getCampaignReport(id);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Error fetching campaign report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/campaigns/:id/clicks', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const clicks = await mailchimpService.getCampaignClickDetails(id);
    res.json({ success: true, data: clicks });
  } catch (error) {
    logger.error('Error fetching campaign clicks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/campaigns/:id/opens', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const opens = await mailchimpService.getCampaignOpenDetails(id);
    res.json({ success: true, data: opens });
  } catch (error) {
    logger.error('Error fetching campaign opens:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mailchimp/campaigns/:id/ecommerce', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const ecommerce = await mailchimpService.getCampaignEcommerceActivity(id);
    res.json({ success: true, data: ecommerce });
  } catch (error) {
    logger.error('Error fetching campaign ecommerce:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const action = req.query.action || 'all';
    const tableName = req.query.table || 'all';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const adminId = req.query.adminId;
    
    const whereClause = {};
    
    if (action !== 'all') {
      whereClause.action = action;
    }
    
    if (tableName !== 'all') {
      whereClause.tableName = tableName;
    }
    
    if (adminId) {
      whereClause.adminId = adminId;
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(endDate);
      }
    }
    
    const total = await AdminAuditLog.count({ where: whereClause });
    
    const auditLogs = await AdminAuditLog.findAll({
      where: whereClause,
      include: [{
        model: Profile,
        as: 'admin',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit
    });
    
    const transformedLogs = auditLogs.map(log => {
      const logData = log.toJSON();
      return {
        id: logData.id,
        admin: logData.admin ? {
          id: logData.admin.id,
          name: `${logData.admin.firstName} ${logData.admin.lastName}`,
          email: logData.admin.email
        } : null,
        action: logData.action,
        tableName: logData.tableName,
        recordId: logData.recordId,
        oldValues: logData.oldValues ? JSON.parse(logData.oldValues) : null,
        newValues: logData.newValues ? JSON.parse(logData.newValues) : null,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        createdAt: logData.createdAt
      };
    });
    
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: transformedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
    
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch audit logs'
    });
  }
});


router.get('/promo-codes', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', active } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    if (search) {
      whereClause.code = {
        [Op.iLike]: `%${search}%`
      };
    }
    
    if (active !== undefined) {
      whereClause.active = active === 'true';
    }

    const { count, rows: promoCodes } = await PromoCode.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        promoCodes,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching promo codes:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch promo codes'
    });
  }
});

router.get('/promo-codes/:id', requireAdmin, async (req, res) => {
  try {
    const promoCode = await PromoCode.findByPk(req.params.id);
    
    if (!promoCode) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Promo code not found'
      });
    }

    res.json({
      success: true,
      data: promoCode
    });
  } catch (error) {
    logger.error('Error fetching promo code:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch promo code'
    });
  }
});

router.post('/promo-codes', requireAdmin, [
  body('code').notEmpty().isLength({ min: 1, max: 50 }).withMessage('Code must be 1-50 characters'),
  body('discountType').isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue').isFloat({ min: 0 }).withMessage('Discount value must be a positive number'),
  body('active').optional().isBoolean().withMessage('Active must be a boolean'),
  body('expiresAt').optional().isISO8601().withMessage('Expires at must be a valid date'),
  body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be a positive integer'),
  body('stackable').optional().isBoolean().withMessage('Stackable must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      code,
      discountType,
      discountValue,
      active = true,
      expiresAt,
      usageLimit,
      stackable = false
    } = req.body;

    const existingCode = await PromoCode.findOne({ 
      where: sequelize.where(
        sequelize.fn('UPPER', sequelize.col('code')),
        code.toUpperCase()
      )
    });
    if (existingCode) {
      return res.status(400).json({
        error: 'Code already exists',
        message: 'A promo code with this code already exists'
      });
    }

    const promoCode = await PromoCode.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      active,
      expiresAt: expiresAt || null,
      usageLimit: usageLimit || null,
      stackable
    });

    await logAdminAction(
      req.userId,
      'CREATE',
      'promo_codes',
      promoCode.id,
      null,
      promoCode.toJSON(),
      req
    );

    res.status(201).json({
      success: true,
      data: promoCode,
      message: 'Promo code created successfully'
    });
  } catch (error) {
    logger.error('Error creating promo code:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create promo code'
    });
  }
});

router.put('/promo-codes/:id', requireAdmin, [
  body('code').optional().isLength({ min: 1, max: 50 }).withMessage('Code must be 1-50 characters'),
  body('discountType').optional().isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue').optional().isFloat({ min: 0 }).withMessage('Discount value must be a positive number'),
  body('active').optional().isBoolean().withMessage('Active must be a boolean'),
  body('expiresAt').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Expires at must be a valid date'),
  body('usageLimit').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Usage limit must be a positive integer'),
  body('stackable').optional().isBoolean().withMessage('Stackable must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid promo code data',
        details: errors.array()
      });
    }

    const promoId = String(req.params.id).split(':')[0];
    
    const promoCode = await PromoCode.findByPk(promoId);
    if (!promoCode) {
      return res.status(404).json({
        error: 'Not found',
        message: `Promo code with ID ${promoId} not found`
      });
    }

    const oldValues = promoCode.toJSON();
    const updateData = { ...req.body };
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === null || updateData[key] === '' || updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
      
      const existingCode = await PromoCode.findOne({ 
        where: { 
          [Op.and]: [
            sequelize.where(
              sequelize.fn('UPPER', sequelize.col('code')),
              updateData.code
            ),
            { id: { [Op.ne]: promoId } }
          ]
        } 
      });
      if (existingCode) {
        return res.status(400).json({
          error: 'Code already exists',
          message: 'A promo code with this code already exists'
        });
      }
    }

    await promoCode.update(updateData);

    await logAdminAction(
      req.userId,
      'UPDATE',
      'promo_codes',
      promoCode.id,
      oldValues,
      promoCode.toJSON(),
      req
    );

    res.json({
      success: true,
      data: promoCode,
      message: 'Promo code updated successfully'
    });
  } catch (error) {
    logger.error('Error updating promo code:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update promo code'
    });
  }
});

router.delete('/promo-codes/:id', requireAdmin, async (req, res) => {
  try {
    const promoCode = await PromoCode.findByPk(req.params.id);
    if (!promoCode) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Promo code not found'
      });
    }

    const oldValues = promoCode.toJSON();
    await promoCode.destroy();

    await logAdminAction(
      req.userId,
      'DELETE',
      'promo_codes',
      req.params.id,
      oldValues,
      null,
      req
    );

    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting promo code:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete promo code'
    });
  }
});

router.post('/users/:userId/reset-password', requireAdmin, [
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*\d)/)
    .withMessage('Password must contain at least one number')
    .matches(/^(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one special character')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;
    const bcrypt = require('bcryptjs');

    const user = await Profile.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    await Profile.update(
      { password: hashedPassword, updatedAt: new Date() },
      { where: { id: userId } }
    );

    await logAdminAction(
      req.user.id,
      'UPDATE',
      'profiles',
      userId,
      { password: '[REDACTED]' },
      { password: '[REDACTED]' },
      req
    );

    logger.info('Password reset by admin', {
      adminId: req.user.id,
      targetUserId: userId,
      targetEmail: user.email
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reset password'
    });
  }
});

module.exports = router;
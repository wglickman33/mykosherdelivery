const express = require('express');
const { Op, QueryTypes } = require('sequelize');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Profile, Order, Restaurant, DeliveryZone, SupportTicket, TicketResponse, AdminNotification, Notification, AdminAuditLog, sequelize, MenuItem, MenuItemOption, UserRestaurantFavorite, MenuChangeRequest, UserLoginActivity, UserPreference, UserAnalytic, PaymentMethod, RestaurantOwner, Refund, PromoCode } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { appEvents } = require('../utils/events');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Helper function to log admin actions
const logAdminAction = async (adminId, action, tableName, recordId, oldValues, newValues, req = null) => {
  try {
    // Get IP address and user agent from request
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
    
    logger.info('Admin action logged', {
      adminId,
      action,
      tableName,
      recordId,
      oldValues,
      newValues
    });
  } catch (error) {
    logger.error('Error logging admin action:', error);
    throw error; // Re-throw to be caught by calling function
  }
};

// Helper function to create global admin notifications
async function createGlobalAdminNotification(payload) {
  try {
    const notif = await AdminNotification.create({
      type: payload.type,
      title: payload.title,
      message: payload.body || payload.message || '',
      readBy: [], // Empty array means no admin has read it yet
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


// Get all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { role, limit = 20, offset = 0, search, page = 1 } = req.query;
    
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

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset) || (parseInt(page) - 1) * limitNum;

    // Get total count for pagination
    const total = await Profile.count({ where: whereClause });
    
    // Get users with last login information
    const users = await Profile.findAll({
      where: whereClause,
      attributes: { 
        exclude: ['password'],
        include: [
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
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: offsetNum
    });

    // Transform users to match frontend expectations
    const transformedUsers = users.map(user => {
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
        primary_address_index: userData.primaryAddressIndex
      };
    });

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: transformedUsers,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
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

// Update user profile
router.put('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Remove password from updates if present (should be handled separately)
    delete updates.password;

    // Transform frontend field names to backend field names
    const transformedUpdates = {};
    if (updates.first_name !== undefined) transformedUpdates.firstName = updates.first_name;
    if (updates.last_name !== undefined) transformedUpdates.lastName = updates.last_name;
    if (updates.phone_number !== undefined) transformedUpdates.phone = updates.phone_number;
    if (updates.role !== undefined) transformedUpdates.role = updates.role;
    if (updates.email !== undefined) transformedUpdates.email = updates.email;

    const user = await Profile.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Store old values for audit logging
    const oldValues = user.toJSON();
    delete oldValues.password; // Don't log password changes

    await user.update(transformedUpdates);

    // Log the admin action with before/after values
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
      logger.error('Failed to log admin action for user update:', auditError);
      // Don't fail the request if audit logging fails
    }

    // Create notification for user update
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

    // Transform response back to frontend format
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
      last_login: userData.last_login,
      address: userData.address,
      addresses: userData.addresses,
      primary_address_index: userData.primaryAddressIndex
    };
    
    res.json({
      success: true,
      data: transformedUser,
      message: 'User profile updated successfully'
    });

  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user profile'
    });
  }
});

// Update user role
router.patch('/users/:userId/role', requireAdmin, [
  body('role').isIn(['user', 'restaurant_owner', 'admin'])
], async (req, res) => {
    console.log("Restaurant creation request body:", req.body);
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

    // Store old values for audit logging
    const oldValues = user.toJSON();
    delete oldValues.password; // Don't log password changes

    await user.update({ role });

    // Log the admin action with before/after values
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
      // Don't fail the request if audit logging fails
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

// Create user (admin only)
router.post('/users', requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('role').isIn(['user', 'restaurant_owner', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, firstName, lastName, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await Profile.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    // Create user
    const user = await Profile.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'user',
      phone: phone || null
    });

    // Log admin action
    await logAdminAction(
      req.user.id,
      'CREATE',
      'profiles',
      user.id,
      null,
      { email, firstName, lastName, role },
      req
    );

    // Create notification for user creation
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

    // Transform response to frontend format
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

// Delete user
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

    // Don't allow deleting the last admin
    if (user.role === 'admin') {
      const adminCount = await Profile.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Cannot delete last admin',
          message: 'At least one admin must remain in the system'
        });
      }
    }

    // Create notification for user deletion (before deleting)
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

    // Delete related records first to avoid foreign key constraints
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

    // Also need to handle tables where this user might be referenced by other fields
    const additionalCleanup = [
      { model: AdminAuditLog, field: 'adminId', name: 'admin audit logs' },
      { model: MenuChangeRequest, field: 'requestedBy', name: 'menu change requests (as requester)' },
      { model: MenuChangeRequest, field: 'approvedBy', name: 'menu change requests (as approver)' },
      { model: Refund, field: 'processedBy', name: 'refunds (as processor)' },
      { model: TicketResponse, field: 'responderId', name: 'ticket responses' }
    ];

    // Combine all cleanup tasks
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

    // Handle orders - DELETE them entirely using raw SQL to bypass any constraints
    // The foreign key constraint is set to ON DELETE SET NULL, but user_id has NOT NULL constraint
    // This creates a conflict, so we must delete orders BEFORE deleting the user
    try {
      // First, check how many orders exist
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
        
        // Use raw SQL to delete orders - this bypasses Sequelize hooks and constraints
        await sequelize.query(
          'DELETE FROM orders WHERE user_id = :userId',
          {
            replacements: { userId: userId },
            type: QueryTypes.DELETE
          }
        );
        
        logger.info(`Deleted orders for user ${userId} using raw SQL`);
        
        // Verify deletion worked
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
    
    // Log admin action before deletion (temporarily disabled for debugging)
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
      // Continue with deletion even if audit logging fails
    }

    // Before deletion, verify all references are cleaned up
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

    // Permanently delete user - use raw SQL if Sequelize fails due to constraint
    try {
    await user.destroy({ force: true });
      logger.info(`Successfully deleted user ${userId} using Sequelize`);
    } catch (deleteError) {
      logger.warn(`Sequelize deletion failed for user ${userId}, trying raw SQL:`, deleteError.message);
      
      // Check if this is a constraint error
      const isConstraintError = deleteError.name === 'SequelizeDatabaseError' && 
        (deleteError.message.includes('foreign key') || 
         deleteError.message.includes('constraint') ||
         deleteError.message.includes('not-null') ||
         deleteError.original?.code === '23503' || // Foreign key violation
         deleteError.original?.code === '23502');  // Not null violation
      
      if (isConstraintError) {
        // Try using raw SQL to delete the user, which bypasses Sequelize constraint handling
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
          
          // Final check - maybe there are still orders we missed
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
        // Not a constraint error, re-throw
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

// Get platform analytics
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    // Total users
    const totalUsers = await Profile.count();
    
    // Users by role
    const usersByRole = await Profile.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    // Total orders
    const totalOrders = await Order.count();
    
    // Orders by status
    const ordersByStatus = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Total revenue
    const totalRevenue = await Order.sum('total', {
      where: { status: ['delivered', 'confirmed'] }
    }) || 0;

    // Recent orders (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentOrders = await Order.count({
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    // Total restaurants
    const totalRestaurants = await Restaurant.count();
    
    // Featured restaurants
    const featuredRestaurants = await Restaurant.count({
      where: { featured: true }
    });

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

// Manage restaurants
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

    // Log admin action
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

    // Create notification for restaurant creation
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

// Update restaurant
router.put('/restaurants/:restaurantId', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Get the restaurant before updating to capture the name
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

    // Log admin action
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

    // Create notification for restaurant update
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

// Delete restaurant
router.delete('/restaurants/:restaurantId', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Get the restaurant before deleting to capture the name
    const restaurantToDelete = await Restaurant.findByPk(restaurantId);
    if (!restaurantToDelete) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const restaurantName = restaurantToDelete.name;

    // Clear FK references in orders
    await Order.update({ restaurantId: null }, { where: { restaurantId } });

    // Remove dependent rows to prevent FK issues (include soft-deleted scope)
    await UserRestaurantFavorite.destroy({ where: { restaurantId } });
    await MenuItem.destroy({ where: { restaurantId } });

    // Hard delete restaurant (bypass paranoid)
    const deletedRows = await Restaurant.destroy({ where: { id: restaurantId }, force: true, individualHooks: false });

    if (deletedRows === 0) {
      // Try deleting a soft-deleted row explicitly
      const victim = await Restaurant.findOne({ where: { id: restaurantId }, paranoid: false });
      if (victim) {
        await victim.destroy({ force: true });
        
        // Log admin action
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
        
        // Create notification for restaurant deletion
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

    // Log admin action
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

    // Create notification for restaurant deletion
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

// Cleanup route: delete by name (exact match)
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

// ==================== MENU ITEM MANAGEMENT ====================

// Helper function to validate menu item data based on type
const validateMenuItemData = (data) => {
  const errors = [];
  
  // Common validation
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Item name is required');
  }
  
  if (!data.itemType || !['simple', 'variety', 'builder'].includes(data.itemType)) {
    errors.push('Valid item type is required (simple, variety, builder)');
  }
  
  const priceValue = typeof data.price === 'string' ? parseFloat(data.price) : data.price;
  if (typeof priceValue !== 'number' || isNaN(priceValue) || priceValue < 0) {
    errors.push('Valid price is required');
  }
  
  if (!data.category || data.category.trim().length === 0) {
    errors.push('Category is required');
  }
  
  // Type-specific validation
  if (data.itemType === 'variety') {
    if (!data.options || !data.options.variants || !Array.isArray(data.options.variants)) {
      errors.push('Variants are required for variety items');
    } else if (data.options.variants.length === 0) {
      errors.push('At least one variant is required for variety items');
    } else {
      data.options.variants.forEach((variant, index) => {
        if (!variant.name || variant.name.trim().length === 0) {
          errors.push(`Variant ${index + 1} name is required`);
        }
        const modifierValue = typeof variant.priceModifier === 'string' ? parseFloat(variant.priceModifier) : variant.priceModifier;
        if (typeof modifierValue !== 'number' || isNaN(modifierValue)) {
          errors.push(`Variant ${index + 1} price modifier must be a number`);
        }
      });
    }
  }
  
  if (data.itemType === 'builder') {
    if (!data.options || !data.options.configurations || !Array.isArray(data.options.configurations)) {
      errors.push('Configurations are required for builder items');
    } else if (data.options.configurations.length === 0) {
      errors.push('At least one configuration category is required for builder items');
    } else {
      data.options.configurations.forEach((config, index) => {
        if (!config.category || config.category.trim().length === 0) {
          errors.push(`Configuration ${index + 1} category name is required`);
        }
        if (typeof config.required !== 'boolean') {
          errors.push(`Configuration ${index + 1} required field must be boolean`);
        }
        if (typeof config.maxSelections !== 'number' || config.maxSelections < 1) {
          errors.push(`Configuration ${index + 1} maxSelections must be a positive number`);
        }
        if (!config.options || !Array.isArray(config.options) || config.options.length === 0) {
          errors.push(`Configuration ${index + 1} must have at least one option`);
        } else {
          config.options.forEach((option, optIndex) => {
            if (!option.name || option.name.trim().length === 0) {
              errors.push(`Configuration ${index + 1}, option ${optIndex + 1} name is required`);
            }
            const optionModifierValue = typeof option.priceModifier === 'string' ? parseFloat(option.priceModifier) : option.priceModifier;
            if (typeof optionModifierValue !== 'number' || isNaN(optionModifierValue)) {
              errors.push(`Configuration ${index + 1}, option ${optIndex + 1} price modifier must be a number`);
            }
          });
        }
      });
    }
  }
  
  return errors;
};

// Helper function to normalize menu item data
const normalizeMenuItemData = (data) => {
  const normalized = {
    name: data.name?.trim(),
    description: data.description?.trim() || null,
    price: parseFloat(data.price),
    category: data.category?.trim(),
    imageUrl: data.imageUrl?.trim() || null,
    available: data.available !== false, // default to true
    itemType: data.itemType,
    options: data.options || null,
    labels: data.labels || []
  };
  
  // Ensure options is properly structured for each type
  if (normalized.itemType === 'variety' && normalized.options) {
    normalized.options = {
      variants: normalized.options.variants || []
    };
  }
  
  if (normalized.itemType === 'builder' && normalized.options) {
    normalized.options = {
      configurations: normalized.options.configurations || []
    };
  }
  
  return normalized;
};

// Get all menu items for a restaurant (admin)
router.get('/restaurants/:restaurantId/menu-items', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { category, available, itemType, search, limit = 50, offset = 0 } = req.query;
    
    // Verify restaurant exists
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
    
    // Get total count for pagination
    const total = await MenuItem.count({ where: whereClause });
    
    // Normalize menu items data (especially labels field)
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

// Get single menu item (admin)
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
    
    // Normalize menu item data (especially labels field)
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

// Create new menu item (admin)
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
    if (!value || value.trim() === '') return true; // Allow empty/null
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
    
    // Verify restaurant exists
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }
    
    // Validate menu item data
    const validationErrors = validateMenuItemData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Menu item validation failed',
        details: validationErrors
      });
    }
    
    // Normalize and create menu item
    const normalizedData = normalizeMenuItemData(req.body);
    const menuItem = await MenuItem.create({
      ...normalizedData,
      restaurantId
    });
    
    // Log admin action
    await logAdminAction(
      req.user.id,
      'CREATE',
      'menu_items',
      menuItem.id,
      null,
      normalizedData,
      req
    );
    
    // Create notification for menu item creation
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

    // Emit SSE event for real-time updates
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

// Update menu item (admin)
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
    if (!value || value.trim() === '') return true; // Allow empty/null
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
    
    // Find existing menu item
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
    
    // Merge with existing data for validation
    const mergedData = { ...existingItem.toJSON(), ...req.body };
    
    // Validate merged data
    const validationErrors = validateMenuItemData(mergedData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Menu item validation failed',
        details: validationErrors
      });
    }
    
    // Normalize and update menu item
    const normalizedData = normalizeMenuItemData(mergedData);
    const oldValues = existingItem.toJSON();
    
    await existingItem.update(normalizedData);
    
    // Log admin action
    await logAdminAction(
      req.user.id,
      'UPDATE',
      'menu_items',
      itemId,
      oldValues,
      normalizedData,
      req
    );
    
    // Create notification for menu item update
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

    // Emit SSE event for real-time updates
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

// Delete menu item (admin)
router.delete('/restaurants/:restaurantId/menu-items/:itemId', requireAdmin, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    
    // Find existing menu item
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
    
    // Delete menu item
    await existingItem.destroy();
    
    // Log admin action
    await logAdminAction(
      req.user.id,
      'DELETE',
      'menu_items',
      itemId,
      existingItem.toJSON(),
      null,
      req
    );
    
    // Create notification for menu item deletion
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

    // Emit SSE event for real-time updates
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

// Bulk update menu items (admin) - for reordering, bulk availability changes, etc.
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
    
    // Verify restaurant exists
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
        
        // Log admin action
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

// ==================== REAL-TIME UPDATES ====================

// Server-Sent Events stream for menu updates
router.get('/menu-updates/stream', requireAdmin, async (req, res) => {
  try {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Menu updates stream connected' })}\n\n`);

    // Create event listener for menu updates
    const menuUpdateHandler = (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.error('Error sending SSE data:', error);
      }
    };

    // Listen for menu item events
    appEvents.on('menu_item.created', menuUpdateHandler);
    appEvents.on('menu_item.updated', menuUpdateHandler);
    appEvents.on('menu_item.deleted', menuUpdateHandler);

    // Handle client disconnect
    req.on('close', () => {
      appEvents.off('menu_item.created', menuUpdateHandler);
      appEvents.off('menu_item.updated', menuUpdateHandler);
      appEvents.off('menu_item.deleted', menuUpdateHandler);
    });

    // Keep connection alive with periodic ping
    const pingInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      } catch (pingError) {
        console.warn('Error sending ping:', pingError);
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

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

// Public SSE stream for user-facing menu updates (no auth required)
router.get('/public/menu-updates/stream', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({
        error: 'Restaurant ID required',
        message: 'restaurantId query parameter is required'
      });
    }

    // Verify restaurant exists
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ 
      type: 'connected', 
      message: 'Menu updates stream connected',
      restaurantId: restaurantId 
    })}\n\n`);

    // Create event listener for menu updates (filtered by restaurant)
    const menuUpdateHandler = (data) => {
      try {
        // Only send updates for the specific restaurant
        if (data.ref && data.ref.restaurantId === restaurantId) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (sseError) {
        console.error('Error sending SSE data:', sseError);
      }
    };

    // Listen for menu item events
    appEvents.on('menu_item.created', menuUpdateHandler);
    appEvents.on('menu_item.updated', menuUpdateHandler);
    appEvents.on('menu_item.deleted', menuUpdateHandler);

    // Handle client disconnect
    req.on('close', () => {
      appEvents.off('menu_item.created', menuUpdateHandler);
      appEvents.off('menu_item.updated', menuUpdateHandler);
      appEvents.off('menu_item.deleted', menuUpdateHandler);
    });

    // Keep connection alive with periodic ping
    const pingInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      } catch (pingError) {
        console.warn('Error sending ping:', pingError);
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

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

// Manage delivery zones
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

// Add delivery zone
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

    // Log admin action
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

// Update delivery zone
router.put('/delivery-zones/:zoneId', requireAdmin, async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    // Get original zone before updating
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

    // Log admin action
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

// Dashboard stats endpoint
router.get('/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    // Calculate date range
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

    // Get orders in time range
    const orders = await Order.findAll({
      where: {
        createdAt: { [Op.gte]: startDate }
      }
    });

    // Calculate stats
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get total counts
    const totalUsers = await Profile.count();
    const totalRestaurants = await Restaurant.count();

    // Calculate growth (compare with previous period)
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
      usersGrowth: 0 // Would need user creation tracking
    });

  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch dashboard stats'
    });
  }
});

// Recent orders endpoint
router.get('/orders/recent', requireAdmin, async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    const whereClause = {};
    
    // Handle explicit startDate and endDate parameters
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

// All orders with filters
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
      }
    ];

    // Apply filters
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

    // Handle explicit startDate and endDate parameters
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

    // Enhance orders with restaurant information for multi-restaurant orders
    const enhancedOrders = await Promise.all(rows.map(async (order) => {
      const orderData = order.toJSON();
      
      if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
        // Multi-restaurant order - fetch all restaurant details
        const restaurantIds = Object.keys(orderData.restaurantGroups);
        const restaurants = await Restaurant.findAll({
          where: { id: restaurantIds },
          attributes: ['id', 'name', 'address', 'phone']
        });
        
        orderData.restaurants = restaurants;
        orderData.isMultiRestaurant = restaurants.length > 1;
      } else if (orderData.restaurant) {
        // Single restaurant order - use existing association
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

// Get single order by ID
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

    // Enhance order with restaurant information for multi-restaurant orders
    if (orderData.restaurantGroups && Object.keys(orderData.restaurantGroups).length > 0) {
      // Multi-restaurant order - fetch all restaurant details
      const restaurantIds = Object.keys(orderData.restaurantGroups);
      const restaurants = await Restaurant.findAll({
        where: { id: restaurantIds },
        attributes: ['id', 'name', 'address', 'phone', 'logoUrl']
      });
      
      orderData.restaurants = restaurants;
      orderData.isMultiRestaurant = restaurants.length > 1;
    } else if (orderData.restaurant) {
      // Single restaurant order - use existing association
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

// Get menu items for a specific restaurant
router.get('/restaurants/:restaurantId/menu', requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { category, available = true, search } = req.query;

    // Verify restaurant exists
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

    // Group items by category
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

// Get all menu items across all restaurants (for admin browsing)
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

// Update order (full order update)
router.put('/orders/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order does not exist'
      });
    }

    // Preserve the original total - don't allow updating it via this endpoint
    // The total should remain as the original paid amount for refund purposes
    const originalTotal = order.total;
    delete updateData.total; // Remove total from update data to preserve original

    // Update the order with the provided data (excluding total)
    await order.update(updateData);
    
    // Restore the original total if it was changed
    if (order.total !== originalTotal) {
      await order.update({ total: originalTotal });
    }

    // Log admin action
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

// Delete order
router.delete('/orders/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found', message: 'Order does not exist' });
    }
    
    // Store order data for audit logging before deletion
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

// Update order status
router.patch('/orders/:orderId/status', requireAdmin, [
  body('status').isIn(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'])
], async (req, res) => {
    console.log("Restaurant creation request body:", req.body);
  try {
    const { orderId } = req.params;
    const requestedStatus = req.body.status; // keep original for display

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

    // Log admin action
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

    // Emit notification to all admins with prev -> new (humanized)
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

    // Sync status to Shipday if order has a shipdayOrderId (non-blocking)
    // NOTE: Status changes should primarily come FROM Shipday via webhooks, not TO Shipday
    // When admin assigns driver in Shipday dashboard, webhook will update our system
    // This sync is only for manual admin overrides (like cancelling)
    if (order.shipdayOrderId) {
      try {
        const { updateShipdayOrderStatus, cancelShipdayOrder } = require('../services/shipdayService');
        
        // For cancelled orders, use the cancel endpoint
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
          // For other statuses, attempt to sync (may not be supported by Shipday API)
          // Status changes should come from Shipday dashboard actions via webhooks
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
        // Don't throw - admin action should succeed even if Shipday sync fails
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

// Process refund for an order
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

    // Find order
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

    // Validate refund amount
    const orderTotal = parseFloat(order.total || 0);
    const refundAmount = parseFloat(amount);
    
    // Check for existing refunds
    const existingRefunds = await Refund.findAll({
      where: { orderId: orderId, status: 'processed' }
    });
    const totalRefunded = existingRefunds.reduce((sum, refund) => sum + parseFloat(refund.amount), 0);
    const remainingRefundable = orderTotal - totalRefunded;
    
    // For full refund, it should match the remaining refundable amount (not necessarily the full order total if partial refunds were made)
    if (refundType === 'full') {
      // Full refund should refund the remaining amount (could be less than order total if partial refunds were made)
      if (Math.abs(refundAmount - remainingRefundable) > 0.01) {
      return res.status(400).json({
        error: 'Invalid refund amount',
          message: `Full refund amount must match remaining refundable amount of ${remainingRefundable.toFixed(2)}`
      });
      }
    }

    // Validate refund amount doesn't exceed remaining refundable
    if (refundAmount > remainingRefundable) {
      return res.status(400).json({
        error: 'Invalid refund amount',
        message: `Refund amount cannot exceed remaining refundable amount of ${remainingRefundable.toFixed(2)}`
      });
    }

    // Get payment intent ID - try from order first, then look up from Stripe
    let paymentIntentId = order.stripePaymentIntentId || order.stripe_payment_intent_id;
    
    // If not stored in order, try to find it from Stripe using order ID in metadata
    if (!paymentIntentId) {
      try {
        logger.info('Payment intent ID not found in order, searching Stripe...', { orderId });
        
        // Try searching by metadata first (if Stripe search API is available)
        let matchingIntent = null;
        
        try {
          // Search for payment intents with this order ID in metadata
          const paymentIntents = await stripe.paymentIntents.search({
            query: `metadata['orderIds']:'${orderId}'`,
            limit: 10
          });
          
          // Find the payment intent that succeeded and matches this order
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

        // If search didn't work or didn't find anything, try listing by date/amount
        if (!matchingIntent) {
          const orderDate = new Date(order.createdAt);
          const startDate = new Date(orderDate.getTime() - 48 * 60 * 60 * 1000); // 48 hours before
          const endDate = new Date(orderDate.getTime() + 1 * 60 * 60 * 1000); // 1 hour after
          
          const amountInCents = Math.round(orderTotal * 100);
          
          // List payment intents in the time window
          const paymentIntentsList = await stripe.paymentIntents.list({
            created: {
              gte: Math.floor(startDate.getTime() / 1000),
              lte: Math.floor(endDate.getTime() / 1000)
            },
            limit: 100
          });
          
          // Find matching payment intent by amount and order ID in metadata
          matchingIntent = paymentIntentsList.data.find(pi => {
            if (pi.status !== 'succeeded') return false;
            // Check if amount matches (allow small difference for rounding)
            if (Math.abs(pi.amount - amountInCents) > 5) return false; // Allow 5 cent difference
            // Check if order ID is in metadata
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
          
          // Update the order with the found payment intent ID for future use
          try {
            // Try to update the order - handle both camelCase and snake_case field names
            const updateData = {};
            if (order.rawAttributes?.stripePaymentIntentId) {
              updateData.stripePaymentIntentId = paymentIntentId;
            } else if (order.rawAttributes?.stripe_payment_intent_id) {
              updateData.stripe_payment_intent_id = paymentIntentId;
            } else {
              // Try both in case the field exists but isn't in the model definition
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
            // Continue anyway - we have the payment intent ID
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
    
    // If still no payment intent ID found, return error
    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'No payment found',
        message: 'Could not find a Stripe payment intent for this order. The order may not have been paid through Stripe, or the payment intent could not be located.'
      });
    }


    // Create refund record in database first
    const refundRecord = await Refund.create({
      orderId: orderId,
      amount: refundAmount,
      reason: reason,
      processedBy: adminId,
      status: 'pending'
    });

    try {
      // Process refund through Stripe
      const stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100), // Convert to cents
        reason: 'requested_by_customer',
        metadata: {
          orderId: orderId,
          refundId: refundRecord.id,
          processedBy: adminId,
          reason: reason
        }
      });

      // Update refund record with Stripe refund ID
      await refundRecord.update({
        stripeRefundId: stripeRefund.id,
        status: 'processed'
      });

      // Update order status if full refund
      if (refundType === 'full' || Math.abs(refundAmount - remainingRefundable) < 0.01) {
        await order.update({ status: 'cancelled' });
      }

      // Log admin action
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
      // Update refund record to failed status
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

// Get refunds for an order
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

// Get all restaurants for admin
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

// Toggle restaurant featured status
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

    // Log admin action
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

// Upload restaurant logo
router.post('/restaurants/logo/upload', requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.filename;
    
    // Log admin action (logo upload is a restaurant update operation)
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

// ===== GLOBAL ADMIN NOTIFICATIONS =====
router.get('/notifications', requireAdmin, async (req, res) => {
  try {
    const { limit = 250, offset = 0 } = req.query;
    const items = await AdminNotification.findAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // Calculate unread count for this admin (count all notifications, not just returned items)
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
    
    // Log admin action
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
    
    // Calculate unread count for this admin (count all notifications, not just first 20)
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
        
        // Log admin action for each notification marked as read
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

// Delete a global admin notification
router.delete('/notifications/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await AdminNotification.findByPk(id);
    if (!notif) return res.status(404).json({ error: 'Not found' });
    
    // Log admin action before deletion
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
    
    // Calculate unread count for this admin
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

// ===== SUPPORT TICKETS (ADMIN) =====

// List tickets (basic pagination + include requester info)
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
        required: false // LEFT JOIN to include tickets without users
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const data = rows.map(t => {
      // Extract requester info from message if no customer association
      let requester_name = '';
      let requester_email = '';
      
      if (t.customer) {
        // Ticket associated with user account
        requester_name = `${t.customer.firstName || ''} ${t.customer.lastName || ''}`.trim();
        requester_email = t.customer.email || '';
      } else {
        // Guest ticket - extract info from message
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

// Update ticket status
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
    const requested = req.body.status; // preserve for display
    const prevDisplay = typeof req.body.prevDisplay === 'string' ? req.body.prevDisplay : null;
    let status = requested;
    
    // Validate status - allow all valid statuses including 'waiting'
    if (!['open','in_progress','waiting','resolved','closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    
    // Store old values for audit logging
    const prev = ticket.status;
    
    await ticket.update({ status });
    
    // Log the admin action with before/after values
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
      // Don't fail the request if audit logging fails
    }
    const humanize = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const displayNew = requested; // show what the admin selected
    const displayPrev = prevDisplay || prev; // prefer UI column name if provided
    const actor = `${req.user?.firstName || 'Admin'} ${req.user?.lastName || ''}`.trim();
    // notify all admins
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

// Add ticket response
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
    
    // Log admin action
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

// Bulk delete all closed tickets
router.delete('/support/tickets/closed', requireAdmin, async (req, res) => {
  try {
    // Get closed tickets before deletion for audit logging
    const closedTickets = await SupportTicket.findAll({ 
      where: { status: 'closed' },
      attributes: ['id', 'subject', 'status', 'createdAt']
    });
    
    const count = await SupportTicket.destroy({ where: { status: 'closed' }, force: true });
    
    // Log the admin action for bulk deletion
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
          null, // No new values for deletion
          req
        );
      } catch (auditError) {
        logger.error('Failed to log admin action for bulk ticket deletion:', auditError);
        // Don't fail the request if audit logging fails
      }
    }
    
    // Create notification for closed tickets deletion
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

// Utility function for relative time
const getRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

router.post('/orders/stream-token', requireAdmin, async (req, res) => {
  try {
    const token = jwt.sign(
      { userId: req.user.id, scope: 'orders_stream' },
      process.env.JWT_SECRET,
      { expiresIn: '2m' }
    );
    res.json({ token });
  } catch (error) {
    logger.error('Error issuing stream token:', error);
    res.status(500).json({ error: 'Failed to issue stream token' });
  }
});

router.get('/orders/stream', async (req, res) => {
  const token = req.query.token;
  const { Profile } = require('../models');

  try {
    if (!token) {
      logger.warn('SSE stream: No token provided');
      return res.status(401).end();
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.scope !== 'orders_stream') {
      logger.warn('SSE stream: Invalid scope', { scope: decoded.scope, userId: decoded.userId });
      return res.status(403).end();
    }
    
    const user = await Profile.findByPk(decoded.userId);
    if (!user || user.role !== 'admin') {
      logger.warn('SSE stream: User not found or not admin', { userId: decoded.userId, userExists: !!user, role: user?.role });
      return res.status(403).end();
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('SSE stream: Token expired', { expiredAt: error.expiredAt });
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('SSE stream: Invalid token', { error: error.message });
    } else {
      logger.error('SSE stream: Authentication error', error);
    }
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, payload) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeat = setInterval(() => sendEvent('ping', { ts: Date.now() }), 25000);
  sendEvent('connected', { ts: Date.now() });

  const onCreated = (order) => sendEvent('order.created', order);
  const onUpdated = (order) => sendEvent('order.updated', order);
  const onNotification = (payload) => sendEvent('admin.notification.created', payload);

  appEvents.on('order.created', onCreated);
  appEvents.on('order.updated', onUpdated);
  appEvents.on('admin.notification.created', onNotification);

  req.on('close', () => {
    clearInterval(heartbeat);
    appEvents.off('order.created', onCreated);
    appEvents.off('order.updated', onUpdated);
    appEvents.off('admin.notification.created', onNotification);
    res.end();
  });
});

// ===== SUPPORT TICKETS ENDPOINTS =====

// Get support tickets with filtering
router.get('/support-tickets', requireAdmin, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    
    const whereClause = {};
    
    // Handle status filter (can be comma-separated)
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      whereClause.status = { [Op.in]: statuses };
    }
    
    // Handle priority filter
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

// ===== MENU CHANGE REQUESTS ENDPOINTS =====

// Get menu change requests with filtering
router.get('/menu-change-requests', requireAdmin, async (req, res) => {
  try {
    const { status, changeType, page = 1, limit = 20 } = req.query;
    
    const whereClause = {};
    
    // Handle status filter (can be comma-separated)
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      whereClause.status = { [Op.in]: statuses };
    }
    
    // Handle change type filter
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

// ===== SSE STREAMS FOR REQUESTS =====

// SSE stream for requests updates (admin only)
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

  // Send initial count
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

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\n');
    res.write('data: {}\n\n');
  }, 30000);

  // Event handlers
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

// MailChimp Integration Routes
const mailchimpService = require('../services/mailchimpService');

// Campaign routes
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

router.post('/mailchimp/campaigns', requireAdmin, async (req, res) => {
  try {
    const campaignData = req.body;
    const campaign = await mailchimpService.createCampaign(campaignData);
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
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

router.post('/mailchimp/campaigns/:id/test', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { test_emails } = req.body;
    const result = await mailchimpService.sendTestEmail(id, test_emails);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error sending test email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Template routes
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

router.post('/mailchimp/templates', requireAdmin, async (req, res) => {
  try {
    const templateData = req.body;
    const template = await mailchimpService.createTemplate(templateData);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ success: false, error: error.message });
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

// List routes
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

router.post('/mailchimp/lists/:id/members', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const memberData = req.body;
    const member = await mailchimpService.addListMember(id, memberData);
    res.json({ success: true, data: member });
  } catch (error) {
    logger.error('Error adding list member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/mailchimp/lists/:id/members/:email', requireAdmin, async (req, res) => {
  try {
    const { id, email } = req.params;
    const memberData = req.body;
    const member = await mailchimpService.updateListMember(id, email, memberData);
    res.json({ success: true, data: member });
  } catch (error) {
    logger.error('Error updating list member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/mailchimp/lists/:id/members/:email', requireAdmin, async (req, res) => {
  try {
    const { id, email } = req.params;
    await mailchimpService.removeListMember(id, email);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing list member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Account info
router.get('/mailchimp/account', requireAdmin, async (req, res) => {
  try {
    const accountInfo = await mailchimpService.getAccountInfo();
    res.json({ success: true, data: accountInfo });
  } catch (error) {
    logger.error('Error fetching account info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/audit-logs - Fetch audit logs with filtering and pagination
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const action = req.query.action || 'all';
    const tableName = req.query.table || 'all';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const adminId = req.query.adminId;
    
    // Build where clause
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
    
    // Get total count
    const total = await AdminAuditLog.count({ where: whereClause });
    
    // Get audit logs with admin information
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
    
    // Transform the data
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

// ==================== PROMO CODE MANAGEMENT ====================

// Get all promo codes
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

// Get single promo code
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

// Create new promo code
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

    // Check if code already exists (case-insensitive)
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

// Update promo code
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

    // Clean the ID parameter (handle cases where ID might be malformed)
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
    
    // Remove null/empty values to avoid validation issues
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === null || updateData[key] === '' || updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Convert code to uppercase if provided
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
      
      // Check if new code already exists (excluding current record, case-insensitive)
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

// Delete promo code
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

module.exports = router; 
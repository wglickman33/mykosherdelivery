'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Update Profile table - add new roles and nursing home facility association
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_profiles_role" ADD VALUE IF NOT EXISTS 'nursing_home_admin';
      ALTER TYPE "enum_profiles_role" ADD VALUE IF NOT EXISTS 'nursing_home_user';
    `);
    
    await queryInterface.addColumn('profiles', 'nursing_home_facility_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'nursing_home_facilities',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 2. Create NursingHomeFacilities table
    await queryInterface.createTable('nursing_home_facilities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      address: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      contact_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      contact_phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      billing_frequency: {
        type: Sequelize.ENUM('weekly', 'monthly'),
        allowNull: false,
        defaultValue: 'monthly'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 3. Create NursingHomeResidents table
    await queryInterface.createTable('nursing_home_residents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'nursing_home_facilities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      assigned_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      room_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      dietary_restrictions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      allergies: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('nursing_home_residents', ['facility_id']);
    await queryInterface.addIndex('nursing_home_residents', ['assigned_user_id']);

    // 4. Create NursingHomeMenuItems table
    await queryInterface.createTable('nursing_home_menu_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      meal_type: {
        type: Sequelize.ENUM('breakfast', 'lunch', 'dinner'),
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM('main', 'side', 'entree', 'dessert', 'soup'),
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      requires_bagel_type: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      excludes_side: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('nursing_home_menu_items', ['meal_type', 'category']);
    await queryInterface.addIndex('nursing_home_menu_items', ['is_active']);

    // 5. Create NursingHomeOrders table
    await queryInterface.createTable('nursing_home_orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'nursing_home_facilities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_by_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      order_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      week_start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      week_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      resident_meals: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'confirmed', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      total_meals: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      tax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      delivery_address: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      deadline: {
        type: Sequelize.DATE,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('nursing_home_orders', ['order_number'], { unique: true });
    await queryInterface.addIndex('nursing_home_orders', ['facility_id']);
    await queryInterface.addIndex('nursing_home_orders', ['created_by_user_id']);
    await queryInterface.addIndex('nursing_home_orders', ['status']);
    await queryInterface.addIndex('nursing_home_orders', ['week_start_date', 'week_end_date']);

    // 6. Create NursingHomeInvoices table
    await queryInterface.createTable('nursing_home_invoices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'nursing_home_facilities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      invoice_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      billing_period_start: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      billing_period_end: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      order_ids: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        allowNull: false,
        defaultValue: []
      },
      total_meals: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      tax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('nursing_home_invoices', ['invoice_number'], { unique: true });
    await queryInterface.addIndex('nursing_home_invoices', ['facility_id']);
    await queryInterface.addIndex('nursing_home_invoices', ['status']);
    await queryInterface.addIndex('nursing_home_invoices', ['billing_period_start', 'billing_period_end']);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('nursing_home_invoices');
    await queryInterface.dropTable('nursing_home_orders');
    await queryInterface.dropTable('nursing_home_menu_items');
    await queryInterface.dropTable('nursing_home_residents');
    await queryInterface.dropTable('nursing_home_facilities');
    
    // Remove column from profiles
    await queryInterface.removeColumn('profiles', 'nursing_home_facility_id');
    
    // Note: Cannot easily remove enum values in PostgreSQL, would require recreating the enum
  }
};

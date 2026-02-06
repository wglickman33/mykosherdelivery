'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create NursingHomeResidentOrders table for per-resident billing
    await queryInterface.createTable('nursing_home_resident_orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      resident_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'nursing_home_residents',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
      meals: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'paid', 'in_progress', 'completed', 'cancelled'),
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
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.STRING,
        allowNull: true
      },
      payment_intent_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true
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
      resident_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      room_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      billing_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      billing_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
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

    // Add indexes
    await queryInterface.addIndex('nursing_home_resident_orders', ['order_number'], { unique: true });
    await queryInterface.addIndex('nursing_home_resident_orders', ['resident_id']);
    await queryInterface.addIndex('nursing_home_resident_orders', ['facility_id']);
    await queryInterface.addIndex('nursing_home_resident_orders', ['created_by_user_id']);
    await queryInterface.addIndex('nursing_home_resident_orders', ['status']);
    await queryInterface.addIndex('nursing_home_resident_orders', ['payment_status']);
    await queryInterface.addIndex('nursing_home_resident_orders', ['week_start_date', 'week_end_date']);

    // Add billing fields to residents table
    await queryInterface.addColumn('nursing_home_residents', 'billing_email', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Email for weekly invoices (resident or family member)'
    });

    await queryInterface.addColumn('nursing_home_residents', 'billing_name', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Name of person responsible for payment'
    });

    await queryInterface.addColumn('nursing_home_residents', 'billing_phone', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Phone number for billing contact'
    });

    await queryInterface.addColumn('nursing_home_residents', 'payment_method_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Stripe payment method ID for automatic weekly billing'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop table
    await queryInterface.dropTable('nursing_home_resident_orders');
    
    // Remove columns from residents table
    await queryInterface.removeColumn('nursing_home_residents', 'billing_email');
    await queryInterface.removeColumn('nursing_home_residents', 'billing_name');
    await queryInterface.removeColumn('nursing_home_residents', 'billing_phone');
    await queryInterface.removeColumn('nursing_home_residents', 'payment_method_id');
  }
};

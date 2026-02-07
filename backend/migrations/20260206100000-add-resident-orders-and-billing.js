'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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

    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS nursing_home_resident_orders_order_number ON nursing_home_resident_orders (order_number);');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS nursing_home_resident_orders_resident_id ON nursing_home_resident_orders (resident_id);');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS nursing_home_resident_orders_facility_id ON nursing_home_resident_orders (facility_id);');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS nursing_home_resident_orders_created_by_user_id ON nursing_home_resident_orders (created_by_user_id);');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS nursing_home_resident_orders_status ON nursing_home_resident_orders (status);');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS nursing_home_resident_orders_payment_status ON nursing_home_resident_orders (payment_status);');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS nursing_home_resident_orders_week_start_date_week_end_date ON nursing_home_resident_orders (week_start_date, week_end_date);');

    await queryInterface.sequelize.query(`
      ALTER TABLE nursing_home_residents ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255) NULL;
      ALTER TABLE nursing_home_residents ADD COLUMN IF NOT EXISTS billing_name VARCHAR(255) NULL;
      ALTER TABLE nursing_home_residents ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(255) NULL;
      ALTER TABLE nursing_home_residents ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(255) NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('nursing_home_resident_orders');
    
    await queryInterface.removeColumn('nursing_home_residents', 'billing_email');
    await queryInterface.removeColumn('nursing_home_residents', 'billing_name');
    await queryInterface.removeColumn('nursing_home_residents', 'billing_phone');
    await queryInterface.removeColumn('nursing_home_residents', 'payment_method_id');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('nursing_home_refunds', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      resident_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'nursing_home_resident_orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      stripe_refund_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      processed_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'profiles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      status: {
        type: Sequelize.ENUM('pending', 'processed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
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

    await queryInterface.addIndex('nursing_home_refunds', ['resident_order_id']);
    await queryInterface.addIndex('nursing_home_refunds', ['processed_by']);
    await queryInterface.addIndex('nursing_home_refunds', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nursing_home_refunds');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_nursing_home_refunds_status";');
  }
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('platform_expenses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      expense_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Date of the expense (for P&L period attribution)'
      },
      category: {
        type: Sequelize.STRING(64),
        allowNull: false,
        comment: 'e.g. driver_pay, other'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'profiles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
    await queryInterface.addIndex('platform_expenses', ['expense_date']);
    await queryInterface.addIndex('platform_expenses', ['category']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('platform_expenses');
  }
};

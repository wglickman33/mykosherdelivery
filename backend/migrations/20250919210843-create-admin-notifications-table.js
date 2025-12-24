'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('admin_notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      read_by: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('admin_notifications', ['read_by']);
    await queryInterface.addIndex('admin_notifications', ['type']);
    await queryInterface.addIndex('admin_notifications', ['created_at']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('admin_notifications');
  }
};
'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_login_activities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      login_time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      success: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
    });

    await queryInterface.addIndex('user_login_activities', ['user_id']);
    await queryInterface.addIndex('user_login_activities', ['login_time']);
    await queryInterface.addIndex('user_login_activities', ['success']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_login_activities');
  }
};

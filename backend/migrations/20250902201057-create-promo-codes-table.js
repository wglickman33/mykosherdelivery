'use strict';


module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promo_codes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      discount_type: {
        type: Sequelize.ENUM('percentage', 'fixed'),
        allowNull: false,
        defaultValue: 'percentage'
      },
      discount_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      usage_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Maximum number of times this code can be used (null = unlimited)'
      },
      usage_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Current number of times this code has been used'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('promo_codes', ['code']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('promo_codes');
  }
};

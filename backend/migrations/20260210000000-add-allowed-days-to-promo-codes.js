'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('promo_codes');
    if (!tableDescription.allowed_days) {
      await queryInterface.addColumn('promo_codes', 'allowed_days', {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Comma-separated day numbers (0=Sun..6=Sat). Null/empty = valid every day.'
      });
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('promo_codes');
    if (tableDescription.allowed_days) {
      await queryInterface.removeColumn('promo_codes', 'allowed_days');
    }
  }
};

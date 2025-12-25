'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('promo_codes');
    if (!tableDescription.stackable) {
    await queryInterface.addColumn('promo_codes', 'stackable', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('promo_codes');
    if (tableDescription.stackable) {
    await queryInterface.removeColumn('promo_codes', 'stackable');
    }
  }
};

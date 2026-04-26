'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('promo_codes', 'apply_to_delivery', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'When true, the discount reduces the delivery fee instead of (or in addition to) the subtotal'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('promo_codes', 'apply_to_delivery');
  }
};

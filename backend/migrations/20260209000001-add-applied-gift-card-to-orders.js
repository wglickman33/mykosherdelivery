'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'applied_gift_card', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Applied gift card: { giftCardId, code, amountApplied }'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'applied_gift_card');
  }
};

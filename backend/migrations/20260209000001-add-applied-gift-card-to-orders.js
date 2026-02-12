'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('orders');
    if (!tableDescription.applied_gift_card) {
      await queryInterface.addColumn('orders', 'applied_gift_card', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Applied gift card: { giftCardId, code, amountApplied }'
      });
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('orders');
    if (tableDescription.applied_gift_card) {
      await queryInterface.removeColumn('orders', 'applied_gift_card');
    }
  }
};

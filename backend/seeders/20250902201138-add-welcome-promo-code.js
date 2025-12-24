'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('promo_codes', [{
      code: 'Welcome2MKD',
      discount_type: 'percentage',
      discount_value: 15.00,
      active: true,
      expires_at: null, // Never expires
      usage_limit: null, // Unlimited usage
      usage_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('promo_codes', {
      code: 'Welcome2MKD'
    }, {});
  }
};

'use strict';

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT 1 FROM promo_codes WHERE code = 'Welcome2MKD' LIMIT 1"
    ).catch(() => [[]]);
    if (Array.isArray(existing) && existing.length > 0) return;

    await queryInterface.bulkInsert('promo_codes', [{
      code: 'Welcome2MKD',
      discount_type: 'percentage',
      discount_value: 15.00,
      active: true,
      expires_at: null,
      usage_limit: null,
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

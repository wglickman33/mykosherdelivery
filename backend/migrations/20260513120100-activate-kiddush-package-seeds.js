'use strict';

/** Make seeded Kiddush packages visible with placeholder pricing until admin edits. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE kiddush_packages
      SET
        is_active = true,
        price = 99.99,
        included_items = '["Placeholder — edit menu, pricing, and included items in Admin → Restaurant Management → Kiddush Menu."]'::jsonb
      WHERE category IN ('kiddush', 'shalom_zachor');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE kiddush_packages
      SET is_active = false, price = 0, included_items = '[]'::jsonb
      WHERE category IN ('kiddush', 'shalom_zachor');
    `);
  }
};

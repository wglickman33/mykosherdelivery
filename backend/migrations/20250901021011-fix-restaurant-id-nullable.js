'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Use raw SQL to drop the NOT NULL constraint
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN restaurant_id DROP NOT NULL;'
    );
  },

  async down(queryInterface) {
    // Revert back to NOT NULL (but this might fail if there are null values)
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN restaurant_id SET NOT NULL;'
    );
  }
};

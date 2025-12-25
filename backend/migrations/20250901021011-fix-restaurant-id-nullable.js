'use strict';


module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN restaurant_id DROP NOT NULL;'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN restaurant_id SET NOT NULL;'
    );
  }
};

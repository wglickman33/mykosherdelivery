'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE nursing_home_facilities
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255) NULL;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('nursing_home_facilities', 'logo_url');
  }
};

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'nursing_home_facilities',
      'logo_url',
      { type: Sequelize.STRING, allowNull: true }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('nursing_home_facilities', 'logo_url');
  }
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'kosher_maps_restaurants',
      'timezone',
      { type: Sequelize.STRING, allowNull: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('kosher_maps_restaurants', 'timezone');
  }
};

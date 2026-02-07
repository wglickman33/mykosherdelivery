'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'kosher_maps_restaurants',
      'hours_of_operation',
      { type: Sequelize.TEXT, allowNull: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('kosher_maps_restaurants', 'hours_of_operation');
  }
};

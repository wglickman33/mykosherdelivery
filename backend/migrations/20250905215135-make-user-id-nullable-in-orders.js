'use strict';


module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('orders', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'profiles',
        key: 'id'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('orders', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'profiles',
        key: 'id'
      }
    });
  }
};

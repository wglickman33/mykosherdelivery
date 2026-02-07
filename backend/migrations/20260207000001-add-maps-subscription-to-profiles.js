'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('profiles', 'stripe_customer_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('profiles', 'maps_subscription_active', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    await queryInterface.addColumn('profiles', 'maps_subscription_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addIndex('profiles', ['stripe_customer_id'], { name: 'profiles_stripe_customer_id' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('profiles', 'stripe_customer_id');
    await queryInterface.removeColumn('profiles', 'maps_subscription_active');
    await queryInterface.removeColumn('profiles', 'maps_subscription_id');
  }
};

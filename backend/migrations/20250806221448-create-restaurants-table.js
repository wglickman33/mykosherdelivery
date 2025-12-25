'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('restaurants', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT
      },
      phone: {
        type: Sequelize.STRING
      },
      type_of_food: {
        type: Sequelize.STRING
      },
      kosher_certification: {
        type: Sequelize.STRING
      },
      logo_url: {
        type: Sequelize.STRING
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('restaurants', ['id'], {
      unique: true,
      name: 'restaurants_id_unique'
    });
    await queryInterface.addIndex('restaurants', ['featured']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('restaurants');
  }
};

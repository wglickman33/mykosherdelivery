'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('kosher_maps_restaurants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT
      },
      city: {
        type: Sequelize.STRING
      },
      state: {
        type: Sequelize.STRING
      },
      zip: {
        type: Sequelize.STRING
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 7)
      },
      longitude: {
        type: Sequelize.DECIMAL(10, 7)
      },
      phone: {
        type: Sequelize.STRING
      },
      website: {
        type: Sequelize.STRING
      },
      kosher_certification: {
        type: Sequelize.STRING
      },
      google_rating: {
        type: Sequelize.DECIMAL(3, 2)
      },
      google_place_id: {
        type: Sequelize.STRING
      },
      diet_tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      deactivation_reason: {
        type: Sequelize.STRING
      },
      notes: {
        type: Sequelize.TEXT
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

    await queryInterface.addIndex('kosher_maps_restaurants', ['is_active']);
    await queryInterface.addIndex('kosher_maps_restaurants', ['name']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('kosher_maps_restaurants');
  }
};

'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_zones', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      zip_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false
      },
      state: {
        type: Sequelize.STRING,
        allowNull: false
      },
      delivery_fee: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      available: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('delivery_zones', ['zip_code'], {
      unique: true,
      name: 'delivery_zones_zip_code_unique'
    });
    await queryInterface.addIndex('delivery_zones', ['city']);
    await queryInterface.addIndex('delivery_zones', ['state']);
    await queryInterface.addIndex('delivery_zones', ['available']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('delivery_zones');
  }
};

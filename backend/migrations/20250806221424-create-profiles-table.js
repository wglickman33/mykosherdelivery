'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      first_name: {
        type: Sequelize.STRING
      },
      last_name: {
        type: Sequelize.STRING
      },
      phone: {
        type: Sequelize.STRING
      },
      address: {
        type: Sequelize.JSONB
      },
      addresses: {
        type: Sequelize.JSONB,
        defaultValue: '[]'
      },
      primary_address_index: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      role: {
        type: Sequelize.ENUM('user', 'restaurant_owner', 'admin'),
        defaultValue: 'user'
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

    await queryInterface.addIndex('profiles', ['email'], {
      unique: true,
      name: 'profiles_email_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('profiles');
  }
};

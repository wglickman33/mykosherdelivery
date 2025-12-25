'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('payment_methods', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      card_last_four: {
        type: Sequelize.STRING,
        allowNull: false
      },
      card_brand: {
        type: Sequelize.STRING,
        allowNull: false
      },
      card_exp_month: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      card_exp_year: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      cardholder_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      stripe_payment_method_id: {
        type: Sequelize.STRING
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

    await queryInterface.addIndex('payment_methods', ['user_id']);
    await queryInterface.addIndex('payment_methods', ['is_default']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('payment_methods');
  }
};

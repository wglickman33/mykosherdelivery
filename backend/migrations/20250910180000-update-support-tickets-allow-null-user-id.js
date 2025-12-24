'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update the user_id column to allow null values
    await queryInterface.changeColumn('support_tickets', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'profiles',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL' // Set to null when user is deleted instead of deleting ticket
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to not allowing null values
    await queryInterface.changeColumn('support_tickets', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'profiles',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};

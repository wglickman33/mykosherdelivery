'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, drop the existing foreign key constraint
    await queryInterface.removeConstraint('support_tickets', 'support_tickets_user_id_fkey');
    
    // Then alter the column to allow null
    await queryInterface.changeColumn('support_tickets', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'profiles',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to not allowing null values
    await queryInterface.removeConstraint('support_tickets', 'support_tickets_user_id_fkey');
    
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

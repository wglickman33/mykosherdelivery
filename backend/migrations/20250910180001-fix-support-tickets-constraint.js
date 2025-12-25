'use strict';


module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('support_tickets', 'support_tickets_user_id_fkey');
    
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

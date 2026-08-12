'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('nursing_home_residents');
    if (!desc.user_id) {
      await queryInterface.addColumn('nursing_home_residents', 'user_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS nursing_home_residents_user_id_unique
      ON nursing_home_residents (user_id)
      WHERE user_id IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS nursing_home_residents_user_id_unique;
    `);
    const desc = await queryInterface.describeTable('nursing_home_residents');
    if (desc.user_id) {
      await queryInterface.removeColumn('nursing_home_residents', 'user_id');
    }
  }
};

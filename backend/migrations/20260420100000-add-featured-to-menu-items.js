'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('menu_items', 'featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addIndex('menu_items', ['featured'], {
      name: 'menu_items_featured_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('menu_items', 'menu_items_featured_idx');
    await queryInterface.removeColumn('menu_items', 'featured');
  }
};

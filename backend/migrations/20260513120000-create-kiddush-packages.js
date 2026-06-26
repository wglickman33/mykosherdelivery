'use strict';

const { v4: uuidv4 } = require('uuid');

const PACKAGES = [
  { category: 'kiddush', size_tier: '8_12', name: 'Kiddush — 8–12 guests', display_order: 0 },
  { category: 'kiddush', size_tier: '15_20', name: 'Kiddush — 15–20 guests', display_order: 1 },
  { category: 'kiddush', size_tier: '25_plus', name: 'Kiddush — 25+ guests', display_order: 2 },
  { category: 'shalom_zachor', size_tier: '8_12', name: 'Shalom Zachor — 8–12 guests', display_order: 0 },
  { category: 'shalom_zachor', size_tier: '15_20', name: 'Shalom Zachor — 15–20 guests', display_order: 1 },
  { category: 'shalom_zachor', size_tier: '25_plus', name: 'Shalom Zachor — 25+ guests', display_order: 2 },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('kiddush_packages', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(32),
        allowNull: false
      },
      size_tier: {
        type: Sequelize.STRING(16),
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      short_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      included_items: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: Sequelize.literal("'[]'::jsonb")
      },
      image_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('kiddush_packages', {
      fields: ['category', 'size_tier'],
      type: 'unique',
      name: 'kiddush_packages_category_size_tier_unique'
    });

    const now = new Date();
    const rows = PACKAGES.map((p) => ({
      id: uuidv4(),
      category: p.category,
      size_tier: p.size_tier,
      name: p.name,
      price: 0,
      short_description: null,
      included_items: '[]',
      image_url: null,
      is_active: false,
      display_order: p.display_order,
      created_at: now,
      updated_at: now
    }));

    await queryInterface.bulkInsert('kiddush_packages', rows);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('kiddush_packages');
  }
};

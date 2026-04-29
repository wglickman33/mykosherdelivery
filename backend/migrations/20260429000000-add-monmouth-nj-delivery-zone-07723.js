'use strict';

const { v4: uuidv4 } = require('uuid');

/** Additive only: Deal, Monmouth County, NJ — same fee as other NJ counties. */
module.exports = {
  async up(queryInterface) {
    const zip = '07723';
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM delivery_zones WHERE zip_code = :zip LIMIT 1`,
      { replacements: { zip } }
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return;
    }

    await queryInterface.bulkInsert('delivery_zones', [
      {
        id: uuidv4(),
        zip_code: zip,
        city: 'Monmouth County',
        state: 'NJ',
        delivery_fee: 27.0,
        available: true,
        created_at: new Date()
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('delivery_zones', { zip_code: '07723' });
  }
};

'use strict';

const { v4: uuidv4 } = require('uuid');
const { ZONES } = require('../data/deliveryZones');

/** Additive: The Hamptons, NY — zips were only in static fallback, not in DB. */
const HAMPTONS = ZONES.find((z) => z.city === 'The Hamptons');

module.exports = {
  async up(queryInterface) {
    if (!HAMPTONS) return;

    const [existingRows] = await queryInterface.sequelize.query(
      'SELECT zip_code FROM delivery_zones WHERE zip_code = ANY(:zips)',
      { replacements: { zips: HAMPTONS.zips } }
    );
    const existingZips = new Set(
      (Array.isArray(existingRows) ? existingRows : []).map((r) => r.zip_code)
    );

    const rows = HAMPTONS.zips
      .filter((zip) => !existingZips.has(zip))
      .map((zip) => ({
        id: uuidv4(),
        zip_code: zip,
        city: HAMPTONS.city,
        state: HAMPTONS.state,
        delivery_fee: HAMPTONS.deliveryFee,
        available: true,
        created_at: new Date()
      }));

    if (rows.length > 0) {
      await queryInterface.bulkInsert('delivery_zones', rows);
    }
  },

  async down(queryInterface) {
    if (!HAMPTONS) return;
    await queryInterface.bulkDelete('delivery_zones', {
      zip_code: HAMPTONS.zips
    });
  }
};

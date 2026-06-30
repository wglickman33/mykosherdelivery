'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { ZONES } = require('../data/deliveryZones');

/** Additive: The Hamptons, NY — zips were only in static fallback, not in DB. */
const HAMPTONS = ZONES.find((z) => z.city === 'The Hamptons');

module.exports = {
  async up(queryInterface) {
    if (!HAMPTONS) return;

    let existingZips = new Set();
    try {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT zip_code FROM delivery_zones'
      );
      if (Array.isArray(rows)) {
        existingZips = new Set(rows.map((r) => r.zip_code));
      }
    } catch {
      // Table may not exist yet in fresh environments
    }

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
      zip_code: { [Op.in]: HAMPTONS.zips }
    });
  }
};

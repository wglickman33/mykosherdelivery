'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

/** NJ delivery by county label (stored in `city` column). Fee $27 unless changed per county. */
const NJ_COUNTY_ZONES = [
  { county: 'Essex County', delivery_fee: 27.0, zips: ['07039', '07052', '07042', '07043', '07028'] },
  { county: 'Bergen County', delivery_fee: 27.0, zips: ['07666', '07631', '07632', '07621', '07652', '07653', '07410', '07024'] },
  { county: 'Union County', delivery_fee: 27.0, zips: ['07081'] }
];

const NJ_ZONES = NJ_COUNTY_ZONES.map((z) => ({
  city: z.county,
  state: 'NJ',
  delivery_fee: z.delivery_fee,
  zips: z.zips
}));

module.exports = {
  async up(queryInterface) {
    let existingZips = new Set();
    try {
      const [rows] = await queryInterface.sequelize.query('SELECT zip_code FROM delivery_zones');
      if (Array.isArray(rows)) existingZips = new Set(rows.map((r) => r.zip_code));
    // eslint-disable-next-line no-empty -- table may not exist yet
    } catch {
    }

    const zipToZone = new Map();
    for (const zone of NJ_ZONES) {
      for (const zip of zone.zips) {
        zipToZone.set(zip, { city: zone.city, state: zone.state, delivery_fee: zone.delivery_fee });
      }
    }

    const deliveryZones = [];
    for (const [zip, { city, state, delivery_fee }] of zipToZone) {
      if (existingZips.has(zip)) continue;
      deliveryZones.push({
        id: uuidv4(),
        zip_code: zip,
        city,
        state,
        delivery_fee,
        available: true,
        created_at: new Date()
      });
    }

    if (deliveryZones.length > 0) {
      await queryInterface.bulkInsert('delivery_zones', deliveryZones, {});
    }
  },

  async down(queryInterface) {
    const zips = NJ_ZONES.flatMap((z) => z.zips);
    await queryInterface.bulkDelete('delivery_zones', { zip_code: { [Op.in]: zips } }, {});
  }
};

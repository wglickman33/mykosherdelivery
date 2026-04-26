'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const NJ_ZONES = [
  { city: 'Essex County', delivery_fee: 27.00, state: 'NJ', zips: ['07039', '07052', '07042', '07043', '07028'] },
  { city: 'Bergen County', delivery_fee: 27.00, state: 'NJ', zips: ['07666', '07631', '07632', '07621', '07652', '07653', '07410', '07024'] }
];

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

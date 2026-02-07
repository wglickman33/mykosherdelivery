/**
 * Seed 3 placeholder nursing home communities (facilities) for UI/functionality development.
 * Run: node backend/scripts/seed-placeholder-communities.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { NursingHomeFacility } = require('../models');
const logger = require('../utils/logger');

const PLACEHOLDER_FACILITIES = [
  {
    name: 'Sunrise Senior Living',
    address: {
      street: '100 Sunrise Drive',
      city: 'Great Neck',
      state: 'NY',
      zip_code: '11021'
    },
    contactEmail: 'admin@sunrise-placeholder.example',
    contactPhone: '516-555-0100',
    logoUrl: null
  },
  {
    name: 'The Bristal',
    address: {
      street: '200 Bristal Way',
      city: 'Lake Success',
      state: 'NY',
      zip_code: '11042'
    },
    contactEmail: 'office@bristal-placeholder.example',
    contactPhone: '516-555-0200',
    logoUrl: null
  },
  {
    name: 'Gurwin Jewish Nursing & Rehabilitation',
    address: {
      street: '300 Community Drive',
      city: 'Commack',
      state: 'NY',
      zip_code: '11725'
    },
    contactEmail: 'info@gurwin-placeholder.example',
    contactPhone: '631-555-0300',
    logoUrl: null
  }
];

async function seed() {
  try {
    const existing = await NursingHomeFacility.count();
    if (existing >= 3) {
      logger.info('Placeholder communities already exist. Skipping seed.');
      process.exit(0);
      return;
    }

    for (const data of PLACEHOLDER_FACILITIES) {
      const [facility, created] = await NursingHomeFacility.findOrCreate({
        where: { name: data.name },
        defaults: {
          ...data,
          isActive: true,
          billingFrequency: 'monthly'
        }
      });
      if (created) {
        logger.info(`Created facility: ${facility.name} (${facility.id})`);
      } else {
        logger.info(`Facility already exists: ${facility.name}`);
      }
    }

    const count = await NursingHomeFacility.count();
    logger.info(`Done. Total facilities: ${count}`);
    process.exit(0);
  } catch (err) {
    logger.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();

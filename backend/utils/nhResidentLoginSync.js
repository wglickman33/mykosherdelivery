const { NursingHomeResident, Profile } = require('../models');
const logger = require('./logger');

async function ensureResidentForNhUserProfile(profile, options = {}) {
  const { transaction } = options;
  if (!profile || profile.role !== 'nursing_home_user') return null;

  const facilityId = profile.nursingHomeFacilityId;
  if (!facilityId) return null;

  const existing = await NursingHomeResident.findOne({
    where: { userId: profile.id },
    transaction
  });
  if (existing) {
    if (existing.facilityId !== facilityId) {
      await existing.update(
        { facilityId, isActive: true },
        { transaction }
      );
    } else if (!existing.isActive) {
      await existing.update({ isActive: true }, { transaction });
    }
    return existing;
  }

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
    || profile.email
    || 'Resident';

  const resident = await NursingHomeResident.create(
    {
      facilityId,
      userId: profile.id,
      name,
      roomNumber: null,
      billingEmail: profile.email || null,
      billingName: name,
      billingPhone: profile.phone || null,
      isActive: true
    },
    { transaction }
  );

  logger.info('Auto-created nursing home resident for login profile', {
    residentId: resident.id,
    userId: profile.id,
    facilityId
  });

  return resident;
}

async function syncFacilityResidentLogins(facilityId) {
  if (!facilityId) return { created: 0 };

  const profiles = await Profile.findAll({
    where: {
      role: 'nursing_home_user',
      nursingHomeFacilityId: facilityId
    }
  });

  let created = 0;
  for (const profile of profiles) {
    const before = await NursingHomeResident.findOne({ where: { userId: profile.id } });
    const resident = await ensureResidentForNhUserProfile(profile);
    if (!before && resident) created += 1;
  }

  return { created };
}

/**
 * Sync all nursing_home_user profiles that have a facility but no resident.
 */
async function syncAllOrphanNhUserResidents() {
  const profiles = await Profile.findAll({
    where: { role: 'nursing_home_user' }
  });

  let created = 0;
  for (const profile of profiles) {
    if (!profile.nursingHomeFacilityId) continue;
    const before = await NursingHomeResident.findOne({ where: { userId: profile.id } });
    const resident = await ensureResidentForNhUserProfile(profile);
    if (!before && resident) created += 1;
  }

  return { created };
}

module.exports = {
  ensureResidentForNhUserProfile,
  syncFacilityResidentLogins,
  syncAllOrphanNhUserResidents
};

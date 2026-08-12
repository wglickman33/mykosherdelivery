/**
 * Ephemeral nursing-home fixtures for integration tests.
 * Always call cleanup() in afterAll / afterEach so local DB does not fill with junk users.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  Profile,
  NursingHomeFacility,
  NursingHomeResident,
  NursingHomeResidentOrder,
  UserLoginActivity,
  sequelize
} = require('../../models');
const { QueryTypes } = require('sequelize');

const makeSuffix = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function authHeaderFor(userId) {
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '1h', algorithm: 'HS256' }
  );
  return { Authorization: `Bearer ${token}` };
}

async function createNhFixture(label = 'nh') {
  const suffix = makeSuffix();
  const created = {
    suffix,
    facilityIds: [],
    profileIds: [],
    residentIds: [],
    orderIds: []
  };

  const facility = await NursingHomeFacility.create({
    name: `Test Facility ${label} ${suffix}`,
    slug: `test-${label}-${suffix}`,
    address: {
      street: '1 Test St',
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11201'
    },
    isActive: true,
    billingFrequency: 'monthly'
  });
  created.facilityIds.push(facility.id);
  created.facility = facility;

  const passwordHash = await bcrypt.hash('TestPass123!', 10);

  const admin = await Profile.create({
    email: `nh-admin-${suffix}@example.com`,
    password: passwordHash,
    firstName: 'Test',
    lastName: 'Admin',
    role: 'nursing_home_admin',
    nursingHomeFacilityId: facility.id
  });
  created.profileIds.push(admin.id);
  created.admin = admin;
  created.adminAuth = authHeaderFor(admin.id);

  const staff = await Profile.create({
    email: `nh-staff-${suffix}@example.com`,
    password: passwordHash,
    firstName: 'Test',
    lastName: 'Staff',
    role: 'nursing_home_user',
    nursingHomeFacilityId: facility.id
  });
  created.profileIds.push(staff.id);
  created.staff = staff;
  created.staffAuth = authHeaderFor(staff.id);

  const platformAdmin = await Profile.create({
    email: `platform-admin-${suffix}@example.com`,
    password: passwordHash,
    firstName: 'Platform',
    lastName: 'Admin',
    role: 'admin'
  });
  created.profileIds.push(platformAdmin.id);
  created.platformAdmin = platformAdmin;
  created.platformAdminAuth = authHeaderFor(platformAdmin.id);

  const resident = await NursingHomeResident.create({
    facilityId: facility.id,
    name: `Test Resident ${suffix}`,
    roomNumber: '101',
    isActive: true,
    billingEmail: `resident-${suffix}@example.com`
  });
  created.residentIds.push(resident.id);
  created.resident = resident;

  created.cleanup = async () => {
    try {
      if (created.orderIds.length) {
        await NursingHomeResidentOrder.destroy({ where: { id: created.orderIds } });
      }
      await NursingHomeResidentOrder.destroy({ where: { residentId: created.residentIds } });
      await NursingHomeResidentOrder.destroy({ where: { facilityId: created.facilityIds } });
      if (created.residentIds.length) {
        await NursingHomeResident.destroy({ where: { id: created.residentIds } });
      }
      await NursingHomeResident.destroy({ where: { facilityId: created.facilityIds } });
      if (created.profileIds.length) {
        await NursingHomeResident.update(
          { assignedUserId: null },
          { where: { assignedUserId: created.profileIds } }
        );
        if (UserLoginActivity) {
          await UserLoginActivity.destroy({ where: { userId: created.profileIds } });
        }
        try {
          await sequelize.query(
            `DELETE FROM admin_audit_logs WHERE admin_id = ANY(ARRAY[:ids]::uuid[])`,
            { replacements: { ids: created.profileIds }, type: QueryTypes.DELETE }
          );
        } catch (_err) {
          /* optional table */
        }
        await Profile.update(
          { nursingHomeFacilityId: null },
          { where: { id: created.profileIds } }
        );
        await Profile.destroy({ where: { id: created.profileIds } });
      }
      if (created.facilityIds.length) {
        await NursingHomeFacility.destroy({ where: { id: created.facilityIds } });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('NH fixture cleanup warning:', err.message);
    }
  };

  return created;
}

module.exports = {
  createNhFixture,
  authHeaderFor,
  makeSuffix
};

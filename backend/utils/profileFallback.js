const { sequelize, Profile } = require('../models');
const { QueryTypes } = require('sequelize');

const PROFILE_COLUMNS_SAFE = `
  id, email, first_name AS "firstName", last_name AS "lastName",
  phone, preferred_name AS "preferredName", address, addresses,
  primary_address_index AS "primaryAddressIndex", role,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const PROFILE_COLUMNS_WITH_FACILITY = `
  id, email, first_name AS "firstName", last_name AS "lastName",
  phone, preferred_name AS "preferredName", address, addresses,
  primary_address_index AS "primaryAddressIndex", role,
  nursing_home_facility_id AS "nursingHomeFacilityId",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

function isColumnMissingError(err) {
  const msg = String(err?.message || '');
  const orig = String(err?.original?.message || '');
  return /nursing_home_facility_id|column.*does not exist/i.test(msg + ' ' + orig);
}

function isMissingColumnError(err) {
  const msg = String(err?.message || '');
  const orig = String(err?.original?.message || '');
  const combined = `${msg} ${orig}`;
  return (
    /nursing_home_facility_id|column.*does not exist/i.test(combined) ||
    /user_login_activities|relation.*does not exist/i.test(combined)
  );
}

async function getProfileById(userId) {
  const opts = { replacements: { userId }, type: QueryTypes.SELECT };
  try {
    const rows = await sequelize.query(
      `SELECT ${PROFILE_COLUMNS_WITH_FACILITY} FROM profiles WHERE id = :userId`,
      opts
    );
    if (!rows || rows.length === 0) return null;
    return rows[0];
  } catch (err) {
    if (isColumnMissingError(err)) {
      const rows = await sequelize.query(
        `SELECT ${PROFILE_COLUMNS_SAFE} FROM profiles WHERE id = :userId`,
        opts
      );
      if (!rows || rows.length === 0) return null;
      return rows[0];
    }
    throw err;
  }
}

async function getProfilesRaw({ whereClause = '1=1', replacements = {}, order = 'created_at DESC', limit = 20, offset = 0 }) {
  const opts = { replacements: { ...replacements, limit, offset }, type: QueryTypes.SELECT };
  try {
    const rows = await sequelize.query(
      `SELECT ${PROFILE_COLUMNS_WITH_FACILITY} FROM profiles WHERE ${whereClause} ORDER BY ${order} LIMIT :limit OFFSET :offset`,
      opts
    );
    return rows || [];
  } catch (err) {
    if (isColumnMissingError(err)) {
      const rows = await sequelize.query(
        `SELECT ${PROFILE_COLUMNS_SAFE} FROM profiles WHERE ${whereClause} ORDER BY ${order} LIMIT :limit OFFSET :offset`,
        opts
      );
      return rows || [];
    }
    throw err;
  }
}

async function countProfilesRaw(whereClause = '1=1', replacements = {}) {
  const result = await sequelize.query(
    `SELECT COUNT(*) AS count FROM profiles WHERE ${whereClause}`,
    { replacements, type: QueryTypes.SELECT }
  );
  return parseInt(result?.[0]?.count ?? 0, 10);
}

async function getProfilesForAdminList({ role, search, limit, offset }) {
  let whereClause = '1=1';
  const replacements = {};
  if (role && role !== 'all') {
    whereClause += ' AND role = :role';
    replacements.role = role;
  }
  if (search && search.trim()) {
    whereClause += ` AND (
      LOWER(email) LIKE LOWER(:search)
      OR LOWER(first_name) LIKE LOWER(:search)
      OR LOWER(last_name) LIKE LOWER(:search)
      OR phone LIKE :searchPhone
    )`;
    replacements.search = `%${search.trim()}%`;
    replacements.searchPhone = `%${search.trim()}%`;
  }
  const rows = await getProfilesRaw({
    whereClause,
    replacements,
    order: 'created_at DESC',
    limit: Math.min(parseInt(limit, 10) || 20, 10000),
    offset: parseInt(offset, 10) || 0
  });
  return rows.map((r) => ({
    id: r.id,
    first_name: r.firstName,
    last_name: r.lastName,
    email: r.email,
    phone_number: r.phone,
    role: r.role,
    created_at: r.createdAt,
    last_login: null,
    address: r.address,
    addresses: r.addresses,
    primary_address_index: r.primaryAddressIndex,
    ...(r.nursingHomeFacilityId !== undefined && { nursing_home_facility_id: r.nursingHomeFacilityId ?? null })
  }));
}

async function updateProfileSafe(userId, updates) {
  const setParts = [];
  const replacements = { userId };
  if (updates.firstName !== undefined) {
    setParts.push('first_name = :firstName');
    replacements.firstName = updates.firstName;
  }
  if (updates.lastName !== undefined) {
    setParts.push('last_name = :lastName');
    replacements.lastName = updates.lastName;
  }
  if (updates.phone !== undefined) {
    setParts.push('phone = :phone');
    replacements.phone = updates.phone;
  }
  if (updates.email !== undefined) {
    setParts.push('email = :email');
    replacements.email = updates.email;
  }
  if (updates.role !== undefined) {
    setParts.push('role = :role');
    replacements.role = updates.role;
  }
  if (updates.nursingHomeFacilityId !== undefined) {
    setParts.push('nursing_home_facility_id = :nursingHomeFacilityId');
    replacements.nursingHomeFacilityId = updates.nursingHomeFacilityId;
  }
  if (setParts.length === 0) return getProfileById(userId);
  const setClause = setParts.join(', ');
  await sequelize.query(
    `UPDATE profiles SET ${setClause}, updated_at = NOW() WHERE id = :userId`,
    { replacements, type: QueryTypes.UPDATE }
  );
  return getProfileById(userId);
}

async function profileExistsWithEmail(email, excludeUserId) {
  const rows = await sequelize.query(
    'SELECT id FROM profiles WHERE email = :email AND id != :excludeUserId',
    { replacements: { email, excludeUserId }, type: QueryTypes.SELECT }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = { isMissingColumnError, getProfileById, getProfilesRaw, countProfilesRaw, getProfilesForAdminList, updateProfileSafe, profileExistsWithEmail };

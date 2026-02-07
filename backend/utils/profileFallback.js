/**
 * When the DB is missing nursing_home_facility_id (migration not run), Sequelize Profile queries throw.
 * These helpers fetch profile data via raw SQL so endpoints still work.
 */
const { sequelize, Profile } = require('../models');
const { QueryTypes } = require('sequelize');

const PROFILE_COLUMNS_SAFE = `
  id, email, first_name AS "firstName", last_name AS "lastName",
  phone, preferred_name AS "preferredName", address, addresses,
  primary_address_index AS "primaryAddressIndex", role,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

function isMissingColumnError(err) {
  const msg = String(err?.message || '');
  const orig = String(err?.original?.message || '');
  const combined = `${msg} ${orig}`;
  return (
    /nursing_home_facility_id|column.*does not exist/i.test(combined) ||
    /user_login_activities|relation.*does not exist/i.test(combined)
  );
}

/**
 * Fetch one profile by id (no password). Returns null if not found.
 */
async function getProfileById(userId) {
  const rows = await sequelize.query(
    `SELECT ${PROFILE_COLUMNS_SAFE} FROM profiles WHERE id = :userId`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

/**
 * Fetch profiles for admin list (no password), with optional order/limit/offset.
 * whereClause is a raw WHERE fragment; replacements must include any params.
 */
async function getProfilesRaw({ whereClause = '1=1', replacements = {}, order = 'created_at DESC', limit = 20, offset = 0 }) {
  const rows = await sequelize.query(
    `SELECT ${PROFILE_COLUMNS_SAFE} FROM profiles WHERE ${whereClause} ORDER BY ${order} LIMIT :limit OFFSET :offset`,
    { replacements: { ...replacements, limit, offset }, type: QueryTypes.SELECT }
  );
  return rows || [];
}

async function countProfilesRaw(whereClause = '1=1', replacements = {}) {
  const result = await sequelize.query(
    `SELECT COUNT(*) AS count FROM profiles WHERE ${whereClause}`,
    { replacements, type: QueryTypes.SELECT }
  );
  return parseInt(result?.[0]?.count ?? 0, 10);
}

/**
 * Admin list: get profiles with optional role and search. Returns array of plain objects (camelCase).
 * Does not include last_login subquery.
 */
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
    primary_address_index: r.primaryAddressIndex
  }));
}

module.exports = { isMissingColumnError, getProfileById, getProfilesRaw, countProfilesRaw, getProfilesForAdminList };

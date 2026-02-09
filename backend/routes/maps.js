const express = require('express');
const { query, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { KosherMapsRestaurant } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

const mapsRestaurantsQueryValidation = [
  query('search').optional().isString().trim().isLength({ max: 200 }),
  query('diet').optional().isString().trim().isLength({ max: 50 }),
  query('active').optional().isIn(['true', 'false']),
  query('lat').optional().isFloat({ min: -90, max: 90 }).toFloat(),
  query('lng').optional().isFloat({ min: -180, max: 180 }).toFloat(),
  query('swLat').optional().isFloat({ min: -90, max: 90 }).toFloat(),
  query('swLng').optional().isFloat({ min: -180, max: 180 }).toFloat(),
  query('neLat').optional().isFloat({ min: -90, max: 90 }).toFloat(),
  query('neLng').optional().isFloat({ min: -180, max: 180 }).toFloat(),
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt()
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get('/access', authenticateToken, async (req, res) => {
  try {
    const profile = req.user;
    res.json({
      hasAccess: true,
      isAdmin: profile.role === 'admin'
    });
  } catch (err) {
    logger.error('Maps access check failed', { err: err.message });
    res.status(500).json({ error: 'Failed to check maps access' });
  }
});

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 500;

router.get('/restaurants', authenticateToken, mapsRestaurantsQueryValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid query parameters',
        details: errors.array()
      });
    }
    const { search, diet, active = 'true', lat, lng, swLat, swLng, neLat, neLng, limit } = req.query;
    const where = {};

    if (active === 'true') {
      where.isActive = true;
    } else if (active === 'false') {
      where.isActive = false;
    }

    if (search && search.trim()) {
      const term = `%${search.trim().substring(0, 200)}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: term } },
        { address: { [Op.iLike]: term } },
        { city: { [Op.iLike]: term } },
        { state: { [Op.iLike]: term } },
        { kosher_certification: { [Op.iLike]: term } }
      ];
    }

    if (diet && diet.trim()) {
      const tag = diet.trim().toLowerCase().substring(0, 50);
      where.dietTags = { [Op.contains]: [tag] };
    }

    const swLatNum = parseFloat(swLat);
    const swLngNum = parseFloat(swLng);
    const neLatNum = parseFloat(neLat);
    const neLngNum = parseFloat(neLng);
    const hasBounds = Number.isFinite(swLatNum) && Number.isFinite(swLngNum) && Number.isFinite(neLatNum) && Number.isFinite(neLngNum);
    if (hasBounds) {
      const [minLat, maxLat] = swLatNum <= neLatNum ? [swLatNum, neLatNum] : [neLatNum, swLatNum];
      const [minLng, maxLng] = swLngNum <= neLngNum ? [swLngNum, neLngNum] : [neLngNum, swLngNum];
      where.latitude = { [Op.between]: [minLat, maxLat] };
      where.longitude = { [Op.between]: [minLng, maxLng] };
    }

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const attributes = [
      'id', 'name', 'address', 'city', 'state', 'zip',
      'latitude', 'longitude', 'phone', 'website',
      'kosherCertification', 'googleRating', 'googlePlaceId',
      'dietTags', 'isActive', 'deactivationReason',
      'hoursOfOperation', 'timezone'
    ];

    let order = [['name', 'ASC']];
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const rows = await KosherMapsRestaurant.findAll({
      where,
      attributes,
      order,
      limit: limitNum,
      raw: true
    });

    const toFloat = (v) => (v != null && Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);
    let list = rows.map((r) => {
      const dietTags = r.dietTags ?? r.diet_tags;
      return {
        id: r.id,
        name: r.name ?? '',
        address: r.address ?? null,
        city: r.city ?? null,
        state: r.state ?? null,
        zip: r.zip ?? null,
        latitude: toFloat(r.latitude),
        longitude: toFloat(r.longitude),
        phone: r.phone ?? null,
        website: r.website ?? null,
        kosherCertification: r.kosherCertification ?? r.kosher_certification ?? null,
        googleRating: toFloat(r.googleRating ?? r.google_rating),
        googlePlaceId: r.googlePlaceId ?? r.google_place_id ?? null,
        dietTags: Array.isArray(dietTags) ? dietTags : [],
        isActive: Boolean(r.isActive ?? r.is_active ?? true),
        deactivationReason: r.deactivationReason ?? r.deactivation_reason ?? null,
        hoursOfOperation: r.hoursOfOperation ?? r.hours_of_operation ?? null,
        timezone: r.timezone ?? null,
        distance: null
      };
    });

    if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
      list = list.map((r) => {
        if (r.latitude != null && r.longitude != null) {
          r.distance = Math.round(haversineDistance(userLat, userLng, r.latitude, r.longitude) * 10) / 10;
        }
        return r;
      });
      list.sort((a, b) => {
        if (a.distance == null && b.distance == null) return (a.name || '').localeCompare(b.name || '');
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
    }

    res.json({ data: list });
  } catch (err) {
    logger.error('Maps restaurants list failed', { err: err.message });
    res.status(500).json({ error: 'Failed to load restaurants' });
  }
});

module.exports = router;

const express = require('express');
const { Op } = require('sequelize');
const { KosherMapsRestaurant } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

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

router.get('/restaurants', authenticateToken, async (req, res) => {
  try {
    const { search, diet, active = 'true', lat, lng } = req.query;
    const where = {};

    if (active === 'true') {
      where.isActive = true;
    } else if (active === 'false') {
      where.isActive = false;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: term } },
        { address: { [Op.iLike]: term } },
        { city: { [Op.iLike]: term } },
        { state: { [Op.iLike]: term } },
        { kosher_certification: { [Op.iLike]: term } }
      ];
    }

    if (diet && diet.trim()) {
      const tag = diet.trim().toLowerCase();
      where.dietTags = { [Op.contains]: [tag] };
    }

    const attributes = [
      'id', 'name', 'address', 'city', 'state', 'zip',
      'latitude', 'longitude', 'phone', 'website',
      'kosherCertification', 'googleRating', 'googlePlaceId',
      'dietTags', 'isActive', 'deactivationReason'
    ];

    let order = [['name', 'ASC']];
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const rows = await KosherMapsRestaurant.findAll({
      where,
      attributes,
      order,
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

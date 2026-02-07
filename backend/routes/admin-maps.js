const express = require('express');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const { KosherMapsRestaurant } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\n' && !inQuotes)) {
      result.push(current.trim());
      current = '';
      if (c === '\n') break;
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\s*["']|["']\s*$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]).map((v) => v.replace(/^\s*["']|["']\s*$/g, '').trim());
    if (values.some((v) => v.length > 0)) {
      const row = {};
      headers.forEach((h, j) => { row[h] = values[j] || ''; });
      rows.push(row);
    }
  }
  return { headers, rows };
}

const DEACTIVATION_REASONS = ['closed_permanently', 'closed_temporarily', 'other'];

router.get('/restaurants', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, active, diet } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 500);
    const offsetNum = (Math.max(1, parseInt(page, 10)) - 1) * limitNum;

    const where = {};
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: term } },
        { address: { [Op.iLike]: term } },
        { city: { [Op.iLike]: term } },
        { kosher_certification: { [Op.iLike]: term } }
      ];
    }
    if (active === 'true') where.isActive = true;
    else if (active === 'false') where.isActive = false;
    if (diet && diet.trim()) {
      where.dietTags = { [Op.contains]: [diet.trim().toLowerCase()] };
    }

    const { count, rows } = await KosherMapsRestaurant.findAndCountAll({
      where,
      limit: limitNum,
      offset: offsetNum,
      order: [['name', 'ASC']]
    });

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum) || 1
      }
    });
  } catch (err) {
    logger.error('Admin maps list failed', { err: err.message });
    res.status(500).json({ error: err.message || 'Failed to load restaurants' });
  }
});

router.post('/restaurants', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {
      name: (body.name || '').trim() || null,
      address: (body.address || '').trim() || null,
      city: (body.city || '').trim() || null,
      state: (body.state || '').trim() || null,
      zip: (body.zip || '').trim() || null,
      latitude: body.latitude != null ? parseFloat(body.latitude) : null,
      longitude: body.longitude != null ? parseFloat(body.longitude) : null,
      phone: (body.phone || '').trim() || null,
      website: (body.website || '').trim() || null,
      kosherCertification: (body.kosherCertification || body.kosher_certification || '').trim() || null,
      googleRating: body.googleRating != null ? parseFloat(body.googleRating) : null,
      googlePlaceId: (body.googlePlaceId || body.google_place_id || '').trim() || null,
      dietTags: Array.isArray(body.dietTags) ? body.dietTags.map((t) => String(t).toLowerCase()) : (body.dietTags ? String(body.dietTags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : []),
      isActive: body.isActive !== false,
      deactivationReason: DEACTIVATION_REASONS.includes(body.deactivationReason) ? body.deactivationReason : null,
      notes: (body.notes || '').trim() || null
    };
    if (!payload.name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const record = await KosherMapsRestaurant.create(payload);
    res.status(201).json(record);
  } catch (err) {
    logger.error('Admin maps create failed', { err: err.message });
    res.status(500).json({ error: err.message || 'Failed to create restaurant' });
  }
});

router.put('/restaurants/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const record = await KosherMapsRestaurant.findByPk(id);
    if (!record) return res.status(404).json({ error: 'Restaurant not found' });

    const updates = {};
    if (body.name !== undefined) updates.name = (body.name || '').trim() || record.name;
    if (body.address !== undefined) updates.address = (body.address || '').trim() || null;
    if (body.city !== undefined) updates.city = (body.city || '').trim() || null;
    if (body.state !== undefined) updates.state = (body.state || '').trim() || null;
    if (body.zip !== undefined) updates.zip = (body.zip || '').trim() || null;
    if (body.latitude !== undefined) updates.latitude = body.latitude != null ? parseFloat(body.latitude) : null;
    if (body.longitude !== undefined) updates.longitude = body.longitude != null ? parseFloat(body.longitude) : null;
    if (body.phone !== undefined) updates.phone = (body.phone || '').trim() || null;
    if (body.website !== undefined) updates.website = (body.website || '').trim() || null;
    if (body.kosherCertification !== undefined) updates.kosherCertification = (body.kosherCertification || body.kosher_certification || '').trim() || null;
    if (body.googleRating !== undefined) updates.googleRating = body.googleRating != null ? parseFloat(body.googleRating) : null;
    if (body.googlePlaceId !== undefined) updates.googlePlaceId = (body.googlePlaceId || body.google_place_id || '').trim() || null;
    if (body.dietTags !== undefined) {
      updates.dietTags = Array.isArray(body.dietTags) ? body.dietTags.map((t) => String(t).toLowerCase()) : (body.dietTags ? String(body.dietTags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : []);
    }
    if (body.isActive !== undefined) updates.isActive = !!body.isActive;
    if (body.deactivationReason !== undefined) updates.deactivationReason = DEACTIVATION_REASONS.includes(body.deactivationReason) ? body.deactivationReason : (body.deactivationReason === '' ? null : record.deactivationReason);
    if (body.notes !== undefined) updates.notes = (body.notes || '').trim() || null;

    await record.update(updates);
    res.json(record);
  } catch (err) {
    logger.error('Admin maps update failed', { err: err.message });
    res.status(500).json({ error: err.message || 'Failed to update restaurant' });
  }
});

router.post('/restaurants/import', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }
    const { headers, rows } = parseCsvBuffer(req.file.buffer);
    const norm = (h) => (h || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const col = (row, ...names) => {
      for (const n of names) {
        const key = headers.find((h) => norm(h) === norm(n));
        if (key && row[key] !== undefined) return (row[key] || '').trim();
      }
      return '';
    };

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = col(row, 'name', 'restaurant name');
      if (!name) {
        errors.push({ row: i + 2, message: 'Missing name' });
        continue;
      }
      const address = col(row, 'address');
      const city = col(row, 'city');
      const state = col(row, 'state');
      const zip = col(row, 'zip');
      const lat = col(row, 'latitude', 'lat');
      const lng = col(row, 'longitude', 'lng');
      const phone = col(row, 'phone');
      const website = col(row, 'website');
      const certification = col(row, 'kosher_certification', 'kosher certification', 'certification');
      const rating = col(row, 'google_rating', 'rating');
      const placeId = col(row, 'google_place_id', 'place_id');
      const dietRaw = col(row, 'diet_tags', 'diet tags', 'tags');
      const dietTags = dietRaw ? dietRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
      const isActive = col(row, 'is_active', 'active') !== 'false' && col(row, 'is_active', 'active') !== '0';
      const deactivationReason = DEACTIVATION_REASONS.includes(col(row, 'deactivation_reason')) ? col(row, 'deactivation_reason') : null;
      const notes = col(row, 'notes');

      try {
        const where = { name: { [Op.iLike]: name } };
        if (address) where.address = address;
        const existing = await KosherMapsRestaurant.findOne({ where });
        const payload = {
          name,
          address: address || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          latitude: lat ? parseFloat(lat) : null,
          longitude: lng ? parseFloat(lng) : null,
          phone: phone || null,
          website: website || null,
          kosherCertification: certification || null,
          googleRating: rating ? parseFloat(rating) : null,
          googlePlaceId: placeId || null,
          dietTags,
          isActive,
          deactivationReason,
          notes: notes || null
        };
        if (existing) {
          await existing.update(payload);
          updated++;
        } else {
          await KosherMapsRestaurant.create(payload);
          created++;
        }
      } catch (e) {
        errors.push({ row: i + 2, message: e.message || 'Save failed' });
      }
    }

    res.json({ created, updated, errors, totalRows: rows.length });
  } catch (err) {
    logger.error('Admin maps import failed', { err: err.message });
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

module.exports = router;

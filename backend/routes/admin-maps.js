const express = require('express');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { KosherMapsRestaurant } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// #region agent log
function debugLog(location, message, data, hypothesisId) {
  console.log('[AdminMaps import]', location, message, hypothesisId, JSON.stringify(data || {}));
}
// #endregion

function parseXlsxBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) return { headers: [], rows: [] };

  const norm = (h) => (h || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const NAME_HEADERS = new Set(['name', 'restaurant_name', 'restaurant', 'business_name', 'businessname', 'establishment', 'restaurantname']);
  const nameCol = (headers) => headers.findIndex((h) => NAME_HEADERS.has(norm(h)));

  const cellStr = (val) => (val == null || val === '') ? '' : String(val).trim();

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (raw.length < 2) continue;

    for (let headerRowIdx = 0; headerRowIdx <= Math.min(2, raw.length - 2); headerRowIdx++) {
      const headerRow = raw[headerRowIdx];
      const headers = headerRow.map((h) => cellStr(h));
      const nameIdx = nameCol(headers);
      if (nameIdx === -1) continue;
      const dataRows = raw.slice(headerRowIdx + 1);
      const hasAnyName = dataRows.some((row) => {
        const val = row[nameIdx];
        return cellStr(val) !== '';
      });
      if (!hasAnyName) continue;

      const rows = dataRows
        .filter((row) => row.some((cell) => cellStr(cell) !== ''))
        .map((row) => {
          const obj = {};
          headers.forEach((h, j) => {
            const val = cellStr(row[j]);
            obj[h] = val;
            if (j === 0 && val) obj['name'] = obj['name'] || val;
          });
          return obj;
        });
      // #region agent log
      const firstRow = rows[0];
      debugLog('admin-maps.js:parseXlsxBuffer_return_matched', 'parseXlsxBuffer returning from matched header path', {
        sheetName,
        headerRowIdx,
        headers,
        rowCount: rows.length,
        firstRowKeys: firstRow ? Object.keys(firstRow) : [],
        firstRowHasNameKey: firstRow ? ('name' in firstRow) : false,
        firstRowNameLen: firstRow && firstRow.name != null ? String(firstRow.name).length : 0,
        firstHeader: headers[0],
        firstRowFirstHeaderValueLen: firstRow && headers[0] && firstRow[headers[0]] != null ? String(firstRow[headers[0]]).length : 0
      }, 'A');
      // #endregion
      return { headers, rows };
    }
  }

  let best = { count: 0, headers: null, rows: null, sheetName: null };
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (raw.length < 2) continue;
    const headerRow = raw[0].map((h) => cellStr(h));
    const dataRows = raw.slice(1).filter((row) => row.some((cell) => cellStr(cell) !== ''));
    const firstColFilled = dataRows.filter((row) => cellStr(row[0]) !== '').length;
    if (firstColFilled > best.count) {
      const headers = headerRow.map((h, i) => (i === 0 ? 'name' : (h || `col_${i}`)));
      const rows = dataRows.map((row) => {
        const obj = {};
        headers.forEach((h, j) => {
          obj[h] = cellStr(row[j]);
        });
        if (!obj['name'] && cellStr(row[0]) !== '') obj['name'] = cellStr(row[0]);
        return obj;
      });
      best = { count: firstColFilled, headers, rows, sheetName };
    }
  }
  if (best.headers) {
    // #region agent log
    const firstRow = best.rows[0];
    debugLog('admin-maps.js:parseXlsxBuffer_return_best', 'parseXlsxBuffer returning from best fallback', {
      bestSheetName: best.sheetName,
      bestCount: best.count,
      headers: best.headers,
      rowCount: best.rows.length,
      firstRowKeys: firstRow ? Object.keys(firstRow) : [],
      firstRowHasNameKey: firstRow ? ('name' in firstRow) : false,
      firstRowNameLen: firstRow && firstRow.name != null ? String(firstRow.name).length : 0,
      firstRowCol0Raw: firstRow && best.rows[0] ? (best.rows[0].name != null ? 'set' : 'missing') : 'n/a'
    }, 'B');
    // #endregion
    return { headers: best.headers, rows: best.rows };
  }

  const sheetName = sheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = raw[0].map((h) => cellStr(h));
  const rows = raw.slice(1)
    .filter((row) => row.some((cell) => cellStr(cell) !== ''))
    .map((row) => {
      const obj = {};
      headers.forEach((h, j) => {
        obj[h] = cellStr(row[j]);
      });
      return obj;
    });
  // #region agent log
  debugLog('admin-maps.js:parseXlsxBuffer_return_fallback', 'parseXlsxBuffer returning first-sheet fallback', { headers, rowCount: rows.length, firstRowKeys: rows[0] ? Object.keys(rows[0]) : [] }, 'C');
  // #endregion
  return { headers, rows };
}

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

const MAX_STRING = 255;
const MAX_TEXT = 10000;

function toNum(val, min, max) {
  const n = parseFloat(val);
  if (val === '' || val === null || val === undefined) return null;
  if (!Number.isFinite(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
}

function toStr(val, maxLen = MAX_STRING) {
  if (val == null) return null;
  const s = String(val).trim();
  return s === '' ? null : s.slice(0, maxLen);
}

function normalizePayload(body, options = {}) {
  const { allowEmptyName = false } = options;
  const name = toStr(body.name);
  if (!allowEmptyName && !name) return { error: 'Name is required' };

  const dietTagsRaw = body.dietTags;
  let dietTags = [];
  if (Array.isArray(dietTagsRaw)) {
    dietTags = dietTagsRaw.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  } else if (dietTagsRaw != null && dietTagsRaw !== '') {
    dietTags = String(dietTagsRaw).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  const deactivationReason = body.deactivationReason != null && DEACTIVATION_REASONS.includes(body.deactivationReason)
    ? body.deactivationReason
    : null;

  return {
    name: name || (body.name != null ? String(body.name).trim().slice(0, MAX_STRING) : null),
    address: toStr(body.address, MAX_TEXT),
    city: toStr(body.city),
    state: toStr(body.state),
    zip: toStr(body.zip),
    latitude: toNum(body.latitude, -90, 90),
    longitude: toNum(body.longitude, -180, 180),
    phone: toStr(body.phone),
    website: toStr(body.website, 2048),
    kosherCertification: toStr(body.kosherCertification ?? body.kosher_certification),
    googleRating: toNum(body.googleRating ?? body.google_rating, 0, 5),
    googlePlaceId: toStr(body.googlePlaceId ?? body.google_place_id, 512) || null,
    dietTags,
    isActive: body.isActive !== false && body.isActive !== 'false' && body.isActive !== '0',
    deactivationReason,
    hoursOfOperation: toStr(body.hoursOfOperation ?? body.hours_of_operation, MAX_TEXT),
    notes: toStr(body.notes, MAX_TEXT)
  };
}

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
    const normalized = normalizePayload(req.body || {});
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    const record = await KosherMapsRestaurant.create(normalized);
    res.status(201).json(record);
  } catch (err) {
    logger.error('Admin maps create failed', { err: err.message });
    res.status(500).json({ error: err.message || 'Failed to create restaurant' });
  }
});

router.put('/restaurants/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const record = await KosherMapsRestaurant.findByPk(id);
    if (!record) return res.status(404).json({ error: 'Restaurant not found' });

    const merged = { ...record.toJSON(), ...(req.body || {}) };
    const normalized = normalizePayload(merged, { allowEmptyName: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    if (!normalized.name) normalized.name = record.name;
    await record.update(normalized);
    res.json(record);
  } catch (err) {
    logger.error('Admin maps update failed', { err: err.message });
    res.status(500).json({ error: err.message || 'Failed to update restaurant' });
  }
});

router.delete('/restaurants/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const record = await KosherMapsRestaurant.findByPk(id);
    if (!record) return res.status(404).json({ error: 'Restaurant not found' });
    await record.destroy();
    res.status(204).send();
  } catch (err) {
    logger.error('Admin maps delete failed', { err: err.message });
    res.status(500).json({ error: err.message || 'Failed to delete restaurant' });
  }
});

router.post('/restaurants/import', requireAdmin, upload.single('file'), async (req, res) => {
  console.log('[AdminMaps import] ROUTE HIT – file:', !!req.file, 'buffer:', !!(req.file && req.file.buffer));
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }
    const isXlsx = (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      (req.file.originalname && req.file.originalname.toLowerCase().endsWith('.xlsx')));
    const { headers, rows } = isXlsx ? parseXlsxBuffer(req.file.buffer) : parseCsvBuffer(req.file.buffer);
    // #region agent log
    debugLog('admin-maps.js:import_after_parse', 'import after parse', {
      isXlsx,
      headers,
      rowCount: rows.length,
      firstRowKeys: rows[0] ? Object.keys(rows[0]) : [],
      firstHeader: headers[0],
      firstRowFirstHeaderVal: rows[0] && headers[0] !== undefined ? (rows[0][headers[0]] != null ? String(rows[0][headers[0]]).length : 'undefined') : 'n/a'
    }, 'D');
    // #endregion
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
      let name = col(row, 'name', 'restaurant name', 'restaurant', 'business name', 'establishment');
      if (!name && headers[0] !== undefined) {
        const first = (row[headers[0]] || '').trim();
        if (first) name = first;
      }
      // #region agent log
      if (i < 2) {
        const nameFromCol = col(row, 'name', 'restaurant name', 'restaurant', 'business name', 'establishment');
        const firstColVal = headers[0] !== undefined ? (row[headers[0]] || '').trim() : '';
        debugLog('admin-maps.js:import_name_check', 'name resolution for row', {
          rowIndex: i,
          nameFromColLen: nameFromCol ? nameFromCol.length : 0,
          firstColValLen: firstColVal ? firstColVal.length : 0,
          hasName: !!name,
          headers0: headers[0],
          rowKeys: Object.keys(row)
        }, 'E');
      }
      // #endregion
      if (!name) {
        // #region agent log
        debugLog('admin-maps.js:import_missing_name', 'Missing name pushed', { rowIndex: i, rowDisplay: i + 2, rowKeys: Object.keys(row), headers0: headers[0], rowFirstCol: headers[0] !== undefined ? (row[headers[0]] != null ? 'set' : 'missing') : 'n/a' }, 'F');
        // #endregion
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
      const hoursOfOperation = col(row, 'hours_of_operation', 'hours of operation', 'hours');
      const notes = col(row, 'notes');

      const rowBody = {
        name,
        address,
        city,
        state,
        zip,
        latitude: lat,
        longitude: lng,
        phone,
        website,
        kosherCertification: certification,
        googleRating: rating,
        googlePlaceId: placeId,
        dietTags,
        isActive,
        deactivationReason,
        hoursOfOperation: hoursOfOperation || undefined,
        notes
      };
      const payload = normalizePayload(rowBody);
      if (payload.error) {
        errors.push({ row: i + 2, message: payload.error });
        continue;
      }

      try {
        const where = { name: { [Op.iLike]: payload.name } };
        if (payload.address) where.address = payload.address;
        const existing = await KosherMapsRestaurant.findOne({ where });
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

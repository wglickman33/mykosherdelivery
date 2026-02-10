const path = require('path');
const ExcelJS = require('exceljs');
const { Restaurant, MenuItem, sequelize } = require('../models');
const { validateMenuItemData } = require('../utils/menuItemValidation');
const logger = require('../utils/logger');

const DEFAULT_CATEGORY = 'general';

function stripHtml(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function roundPrice(v) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function parseCsvLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if ((c === delimiter || c === '\n') && !inQuotes) {
      result.push(current.trim());
      current = '';
      if (c === '\n') break;
    } else current += c;
  }
  result.push(current.trim());
  return result;
}

function splitCsvLines(text, delimiter = ',') {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQuotes = !inQuotes; current += c; }
    else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\n' || text[i + 1] !== '\n') lines.push(current);
      current = '';
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else { if (c !== '\r') current += c; }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function csvBufferToRows(buffer) {
  const text = buffer.toString('utf8');
  const lines = splitCsvLines(text, ',').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const firstCells = parseCsvLine(lines[0], ',').map((c) => c.replace(/^\s*["']|["']\s*$/g, '').trim());
  const rows = [firstCells];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], ',').map((c) => c.replace(/^\s*["']|["']\s*$/g, '').trim());
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return rows;
}

async function xlsxBufferToRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  let maxCol = 0;
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const v = cell.value;
      vals[colNumber - 1] = v == null ? '' : String(v).trim();
    });
    if (vals.length > maxCol) maxCol = vals.length;
    rows.push(vals);
  });
  const padded = rows.map((r) => {
    while (r.length < maxCol) r.push('');
    return r;
  });
  return padded;
}

function bufferToLines(buffer, mimetype, filename) {
  const ext = filename ? path.extname(filename).toLowerCase() : '';
  const isXlsx = mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx';
  const isCsv = mimetype === 'text/csv' || ext === '.csv' || (!isXlsx && buffer.toString('utf8', 0, 500).includes(','));
  if (isXlsx) {
    return xlsxBufferToRows(buffer).then((rows) => rows.map((r) => (Array.isArray(r) ? r : []).join('\t')));
  }
  if (isCsv) {
    const rows = csvBufferToRows(buffer);
    return Promise.resolve(rows.map((r) => (Array.isArray(r) ? r : []).join('\t')));
  }
  const text = buffer.toString('utf8');
  return Promise.resolve(text.split(/\r?\n/).filter((l) => l.trim().length > 0));
}

function parseLinesToParsed(lines, options = {}) {
  const overrideRestaurantId = options.overrideRestaurantId || null;
  if (!lines || lines.length < 2) return { parsed: [], isLongFormat: false };
  const header = (lines[0] || '').toLowerCase();
  const isLongFormat = header.includes('title') && header.includes('product page');
  const parsed = [];
  let lastProductId = '';
  let lastName = '';
  let lastRestaurant = '';
  let lastCategory = '';
  let lastDescription = '';

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    const restaurantFromCol = (parts[3] || '').trim();
    const restaurantName = overrideRestaurantId || restaurantFromCol;
    if (!restaurantName && !overrideRestaurantId) continue;

    if (isLongFormat && parts.length >= 25) {
      const productId = (parts[0] || '').trim();
      const name = (parts[5] || '').trim();
      const description = stripHtml((parts[6] || '').trim());
      const price = parseFloat(parts[20]);
      const category = (parts[24] || '').trim().replace(/^\//, '');
      const visible = (parts[30] || '').trim().toLowerCase() === 'yes';
      const optionPairs = [];
      for (let k = 0; k < 6; k++) {
        const oName = (parts[8 + k * 2] || '').trim();
        const oVal = (parts[9 + k * 2] || '').trim();
        if (oName || oVal) optionPairs.push({ name: oName || `Option ${k + 1}`, value: oVal || 'Default' });
      }
      const resolvedName = name || lastName;
      const resolvedProductId = productId || lastProductId;
      if (!resolvedName && !resolvedProductId) continue;
      if (name) {
        lastProductId = productId;
        lastName = name;
        lastRestaurant = restaurantName;
        lastCategory = category;
        lastDescription = description;
      }
      parsed.push({
        productId: resolvedProductId || `row-${i}`,
        restaurantName: restaurantName || lastRestaurant,
        name: resolvedName,
        description: (description || lastDescription) || null,
        price: Number.isFinite(price) ? price : 0,
        category: (category || lastCategory) || null,
        available: visible,
        optionPairs
      });
    } else if (parts.length >= 8) {
      const category = (parts[4] || '').trim().replace(/^\//, '');
      const name = (parts[5] || '').trim();
      const description = stripHtml((parts[6] || '').trim());
      const price = parseFloat(parts[7]) || 0;
      const visible = parts.length > 12 ? (parts[12] || '').trim().toLowerCase() === 'yes' : true;
      const productType = (parts[2] || '').trim();
      const variants = (parts[10] || '').trim();
      if (!name) continue;
      parsed.push({
        productId: (parts[0] || '').trim() || `row-${i}`,
        restaurantName,
        name,
        description: description || null,
        price,
        category: category || null,
        available: visible,
        productType,
        variants,
        optionPairs: variants ? [{ name: 'Variety', value: variants }] : []
      });
    }
  }
  return { parsed, isLongFormat };
}

function buildItemsFromParsed(parsed, isLongFormat) {
  const byKey = new Map();
  for (const row of parsed) {
    if (!row.restaurantName) continue;
    const key = isLongFormat ? `${row.restaurantName}\t${row.productId}` : `${row.restaurantName}\t${row.productId}\t${row.name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const items = [];
  for (const rows of byKey.values()) {
    const first = rows[0];
    const name = first.name || (first.optionPairs[0] && first.optionPairs[0].value) || 'Unnamed';
    const basePrice = first.price;
    const category = (first.category && first.category.trim()) ? first.category.trim() : DEFAULT_CATEGORY;
    const allOptionNames = new Set();
    for (const r of rows) {
      for (const p of (r.optionPairs || [])) {
        if (p.name && p.name.trim()) allOptionNames.add(p.name.trim());
      }
    }

    if (allOptionNames.size >= 2) {
      const configurations = [];
      for (const optName of allOptionNames) {
        const valueToModifier = new Map();
        for (const r of rows) {
          for (const p of (r.optionPairs || [])) {
            if ((p.name || '').trim() !== optName) continue;
            const v = (p.value || 'Default').trim() || 'Default';
            const mod = Number.isFinite(r.price) && Number.isFinite(basePrice) ? roundPrice(r.price - basePrice) : 0;
            if (!valueToModifier.has(v)) valueToModifier.set(v, mod);
          }
        }
        const options = Array.from(valueToModifier.entries()).map(([optionName, priceModifier]) => ({ name: optionName, priceModifier }));
        if (options.length) configurations.push({ category: optName, required: true, maxSelections: 1, options });
      }
      if (configurations.length >= 2) {
        items.push({
          restaurantName: first.restaurantName,
          name,
          description: first.description,
          price: basePrice,
          category,
          available: first.available !== false,
          itemType: 'builder',
          options: { configurations }
        });
        continue;
      }
    }

    if (allOptionNames.size === 1 || first.productType === 'Variable' || (first.variants && first.variants.trim())) {
      const variantList = rows.map((r) => {
        const vName = (r.optionPairs[0] && r.optionPairs[0].value) || first.variants || 'Default';
        const v = (typeof vName === 'string' ? vName : '').trim() || 'Default';
        const modifier = Number.isFinite(r.price) && Number.isFinite(basePrice) ? roundPrice(r.price - basePrice) : 0;
        return { name: v, priceModifier: modifier };
      });
      if (variantList.length === 0 && first.variants && first.variants.trim()) variantList.push({ name: first.variants.trim(), priceModifier: 0 });
      if (variantList.length > 0) {
        items.push({
          restaurantName: first.restaurantName,
          name,
          description: first.description,
          price: basePrice,
          category,
          available: first.available !== false,
          itemType: 'variety',
          options: { variants: variantList }
        });
        continue;
      }
    }

    items.push({
      restaurantName: first.restaurantName,
      name,
      description: first.description,
      price: basePrice,
      category,
      available: first.available !== false,
      itemType: 'simple',
      options: null
    });
  }
  return items;
}

async function importMenuItemsToRestaurant(restaurantId, items, options = {}) {
  const replace = !!options.replace;
  let created = 0;
  let skipped = 0;
  let replaced = 0;
  const validationErrors = [];
  const t = await sequelize.transaction();
  try {
    const restaurant = await Restaurant.findByPk(restaurantId, { transaction: t });
    if (!restaurant) {
      await t.rollback();
      return { created: 0, skipped: 0, replaced: 0, errors: ['Restaurant not found'] };
    }
    const forRestaurant = items.filter((i) => i.restaurantName === restaurantId);
    if (replace && forRestaurant.length > 0) {
      const deleted = await MenuItem.destroy({ where: { restaurantId }, transaction: t });
      replaced = deleted;
    }
    for (const item of forRestaurant) {
      if (!item.name || !item.name.trim()) continue;
      const existing = await MenuItem.findOne({
        where: { restaurantId, name: item.name.trim() },
        transaction: t
      });
      if (existing) { skipped++; continue; }
      const payload = {
        name: item.name.trim(),
        description: item.description || null,
        price: item.price,
        category: item.category || DEFAULT_CATEGORY,
        available: item.available !== false,
        itemType: item.itemType,
        options: item.options
      };
      const errs = validateMenuItemData(payload);
      if (errs.length) {
        validationErrors.push({ name: item.name, errors: errs });
        continue;
      }
      await MenuItem.create(
        {
          restaurantId,
          name: payload.name,
          description: payload.description,
          price: payload.price,
          category: payload.category,
          imageUrl: null,
          available: payload.available,
          itemType: payload.itemType,
          options: payload.options,
          labels: []
        },
        { transaction: t }
      );
      created++;
    }
    await t.commit();
    return { created, skipped, replaced, errors: validationErrors };
  } catch (err) {
    await t.rollback();
    logger.error('Menu import failed', { err: err.message, restaurantId });
    throw err;
  }
}

async function parseBufferAndImport(restaurantId, buffer, mimetype, filename, options = {}) {
  const lines = await bufferToLines(buffer, mimetype, filename);
  const { parsed, isLongFormat } = parseLinesToParsed(lines, { overrideRestaurantId: restaurantId });
  const items = buildItemsFromParsed(parsed, isLongFormat);
  return importMenuItemsToRestaurant(restaurantId, items, options);
}

module.exports = {
  bufferToLines,
  parseLinesToParsed,
  buildItemsFromParsed,
  importMenuItemsToRestaurant,
  parseBufferAndImport
};

/**
 * Match all 7 restaurant TSV files to the 4 reference restaurants (Central Perk, Graze, Bagel Boys, Alan's):
 * - Categories: simple names, 1-3 words, NO hyphens (e.g. Deli, Rolls, Soups, Fish, Platters).
 * - Descriptions: detailed messages (e.g. "1lb of basturma cold cuts", "1lb of beef jerky").
 * Updates files in place. Run before import.
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

/** Map hyphenated/long category keys to simple display names (no hyphens). Matches the 4 reference restaurants. */
const SIMPLE_CATEGORY = {
  'cold cuts deli': 'Deli',
  'cold-cuts-deli': 'Deli',
  'vegetable and fruit rolls': 'Rolls',
  'vegetable-and-fruit-rolls': 'Rolls',
  'cooked rolls': 'Rolls',
  'cooked-rolls': 'Rolls',
  'specialty rolls': 'Rolls',
  'specialty-rolls': 'Rolls',
  'tempura rolls': 'Tempura Rolls',
  'tempura-rolls': 'Tempura Rolls',
  'raw fish rolls': 'Rolls',
  'raw-fish-rolls': 'Rolls',
  'seaweed outside rolls': 'Rolls',
  'seaweed-outside-rolls': 'Rolls',
  'sushi platters': 'Platters',
  'sushi-platters': 'Platters',
  'soups': 'Soups',
  'fish': 'Fish',
  'platters': 'Platters',
  'mazza': 'Mazza',
  'purim specials': 'Specials',
  'purim-specials': 'Specials',
  'desserts': 'Desserts',
  'deserts': 'Desserts',
  'cream cheese': 'Cream Cheese',
  'cream-cheese': 'Cream Cheese',
  'salads': 'Salads',
  'bagels': 'Bagels',
  'dressings': 'Dressings',
  'pastas': 'Pastas',
  'paninis': 'Paninis',
  'wraps': 'Wraps',
  'sides': 'Sides',
  'burgers': 'Burgers',
  'catering': 'Catering',
  'charcuterie': 'Charcuterie',
  'biltong': 'Biltong',
  'best sellers': 'Best Sellers',
  'jerky platters': 'Jerky Platters',
  'ribs': 'Ribs',
  'pizza': 'Pizza',
  'challahs and rolls': 'Challahs and Rolls',
  'meltaways': 'Meltaways',
  'fruit pies': 'Fruit Pies',
  'bakery cookies': 'Bakery Cookies',
  'rings': 'Rings',
  'brownie cakes': 'Brownie Cakes',
  'large cupcakes': 'Large Cupcakes',
  'soft cookies': 'Soft Cookies',
  'mandelbreads': 'Mandelbreads',
  'doughnuts': 'Doughnuts',
  'babkas': 'Babkas',
  'rugelach': 'Rugelach',
  'gluten free': 'Gluten Free',
  'prepacked brei cheese': 'Cheese',
  'prepacked-brei-cheese': 'Cheese',
  'dips': 'Dips',
  'shabbat takeout': 'Takeout',
  'fish salads': 'Salads',
  'fish-salads': 'Salads',
  'finger food maza': 'Mazza',
  'finger-food-maza': 'Mazza',
  'kugels': 'Kugels',
  'mains': 'Mains',
  'pickles': 'Pickles',
  'herring': 'Fish',
  'vegetable and fruit rolls': 'Rolls',
  'raw fish rolls': 'Rolls',
  'tempura rolls': 'Tempura Rolls',
  'vegetable and fruit': 'Rolls'
};

function toSimpleCategory(cat) {
  if (!cat || !cat.trim()) return cat;
  const raw = cat.replace(/^\/+/, '').trim();
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  const first = key.includes(',') ? key.split(',')[0].trim() : key;
  const simple = SIMPLE_CATEGORY[first] || SIMPLE_CATEGORY[first.replace(/-/g, ' ')];
  if (simple) return (cat.startsWith('/') ? '/' : '') + simple;
  return (cat.startsWith('/') ? '/' : '') + raw.split(/[-/]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').replace(/\s+/g, ' ').trim();
}

/** Strip HTML and normalize spaces. */
function clean(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Produce detailed description to match the 4: e.g. "1lb of basturma cold cuts", "1lb of beef jerky". */
function detailedDescription(desc, title, category, isVariant) {
  const d = clean(desc);
  if (d.length > 50) return d;
  if (isVariant && title) return title.trim() + '.';
  const cat = category ? category.replace(/^\/+/, '').trim() : '';
  const name = (title || '').trim();
  if (!name) return 'See menu.';
  const lowerName = name.toLowerCase();
  const needsDetail = !d || d === 'See menu.' || d === name + '.' || /^1\s*lb\.?$/i.test(d) || /^1lb\.?$/i.test(d) || d === '1lb' || d === '1 LB' || d.length < 10;
  if (!needsDetail) return d;
  if (cat === 'Deli') {
    if (/salami|pastrami|corned beef|roast|turkey|tongue|chopped liver|sautéed liver|beef jerky|prosciutto|bresaolla|basturma|duck|deli roll/i.test(lowerName))
      return `1lb of ${lowerName} cold cuts.`;
    return `${name}. Deli.`;
  }
  if (cat === 'Fish') return `1lb of ${lowerName}. Fish.`;
  if (cat === 'Salads' && /salad/i.test(lowerName)) return `1 LB ${name}.`;
  if (cat === 'Rolls') return `${name}.`;
  if (cat === 'Platters') return `${name}.`;
  return `${name}.`;
}

function processLongFormat(lines) {
  const out = [lines[0]];
  let lastCategory = '';
  let lastTitle = '';
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 25) {
      out.push(lines[i]);
      continue;
    }
    const title = (parts[5] || '').trim();
    const desc = parts[6];
    let cat = (parts[24] || '').trim();
    const isVariant = !title && (parts[8] || parts[9] || '').trim();
    if (cat) lastCategory = cat;
    else if (lastCategory) cat = lastCategory;
    if (title) lastTitle = title;
    const simpleCat = toSimpleCategory(cat || lastCategory);
    parts[24] = simpleCat;
    parts[6] = detailedDescription(desc, title || lastTitle, simpleCat, isVariant);
    out.push(parts.join('\t'));
  }
  return out;
}

function processShortFormat(lines) {
  const out = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 8) {
      out.push(lines[i]);
      continue;
    }
    const name = (parts[5] || '').trim();
    const desc = parts[6];
    const cat = (parts[4] || '').trim();
    parts[4] = toSimpleCategory(cat);
    parts[6] = detailedDescription(desc, name, parts[4], false);
    out.push(parts.join('\t'));
  }
  return out;
}

function processFile(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(DATA_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error('Not found:', fullPath);
    return false;
  }
  const raw = fs.readFileSync(fullPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) return false;
  const header = (lines[0] || '').toLowerCase();
  const isLong = header.includes('title') && header.includes('product page');
  const out = isLong ? processLongFormat(lines) : processShortFormat(lines);
  fs.writeFileSync(fullPath, out.join('\n') + (raw.endsWith('\n') ? '' : '\n'), 'utf8');
  console.log('Matched:', path.basename(filePath));
  return true;
}

const SEVEN = [
  'stop-chop-roll-products.tsv',
  'central-perk-products.tsv',
  'graze-products.tsv',
  'bagel-boys-products.tsv',
  'alans-bakery-products.tsv',
  'five-fifty-products.tsv',
  'mazza-and-more-products.tsv'
];

SEVEN.forEach(processFile);
console.log('Done. All 7 TSV files now have simple categories (no hyphens) and detailed descriptions to match the 4.');

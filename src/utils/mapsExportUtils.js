/**
 * Export maps restaurants to CSV, XLSX, or PDF with optional filters by state, city, zip.
 * @param {Array<object>} list - Full list of place objects from maps
 * @param {object} options - { format: 'csv'|'xlsx'|'pdf', states: string[], cities: string[], zips: string[], filename?: string }
 */

function filterList(list, { states = [], cities = [], zips = [] }) {
  const arr = Array.isArray(list) ? list : [];
  if (!states?.length && !cities?.length && !zips?.length) return arr;
  const stateSet = new Set(states.filter(Boolean).map((s) => String(s).trim()));
  const citySet = new Set(cities.filter(Boolean).map((c) => String(c).trim().toLowerCase()));
  const zipSet = new Set(zips.filter(Boolean).map((z) => String(z).trim()));
  return arr.filter((place) => {
    if (stateSet.size && !stateSet.has(String(place.state || '').trim())) return false;
    if (citySet.size && !citySet.has(String(place.city || '').trim().toLowerCase())) return false;
    if (zipSet.size && !zipSet.has(String(place.zip || '').trim())) return false;
    return true;
  });
}

function row(place) {
  return {
    Name: place.name || '',
    Address: place.address || '',
    City: place.city || '',
    State: place.state || '',
    Zip: place.zip || '',
    Phone: place.phone || '',
    Website: place.website || '',
    'Kosher Certification': place.kosherCertification || '',
    'Google Rating': place.googleRating != null ? String(place.googleRating) : '',
    'Diet Tags': Array.isArray(place.dietTags) ? place.dietTags.join(', ') : '',
    Hours: (place.hoursOfOperation || place.hours_of_operation || '').slice(0, 500),
    Distance: place.distance != null ? String(place.distance) : ''
  };
}

function escapeCsvCell(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportMapsRestaurantsCsv(list, options = {}) {
  const filtered = filterList(Array.isArray(list) ? list : [], options);
  const headers = ['Name', 'Address', 'City', 'State', 'Zip', 'Phone', 'Website', 'Kosher Certification', 'Google Rating', 'Diet Tags', 'Hours', 'Distance'];
  const lines = [headers.map(escapeCsvCell).join(',')];
  filtered.forEach((place) => {
    const r = row(place);
    lines.push(headers.map((h) => escapeCsvCell(r[h])).join(','));
  });
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const name = options.filename || `maps-restaurants-${new Date().toISOString().slice(0, 10)}.csv`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportMapsRestaurantsXlsx(list, options = {}) {
  const filtered = filterList(Array.isArray(list) ? list : [], options);
  const ExcelJS = (await import('exceljs')).default;
  const headers = ['Name', 'Address', 'City', 'State', 'Zip', 'Phone', 'Website', 'Kosher Certification', 'Google Rating', 'Diet Tags', 'Hours', 'Distance'];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Restaurants');
  ws.addRow(headers);
  filtered.forEach((place) => {
    const r = row(place);
    ws.addRow(headers.map((h) => r[h]));
  });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const name = options.filename || `maps-restaurants-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportMapsRestaurantsPdf(list, options = {}) {
  const filtered = filterList(Array.isArray(list) ? list : [], options);
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text('Maps Restaurants Export', 40, 30);
  doc.setFontSize(10);
  doc.text(`Exported ${filtered.length} restaurant(s). ${new Date().toLocaleDateString()}`, 40, 48);
  const headers = [['Name', 'Address', 'City', 'State', 'Zip', 'Phone', 'Website', 'Cert', 'Rating', 'Diets', 'Distance']];
  const body = (filtered || []).map((place) => [
    (place.name || '').slice(0, 24),
    (place.address || '').slice(0, 28),
    (place.city || '').slice(0, 14),
    (place.state || '').slice(0, 8),
    (place.zip || '').slice(0, 10),
    (place.phone || '').slice(0, 14),
    (place.website || '').slice(0, 20),
    (place.kosherCertification || '').slice(0, 12),
    place.googleRating != null ? String(place.googleRating) : '',
    Array.isArray(place.dietTags) ? place.dietTags.slice(0, 2).join(', ') : '',
    place.distance != null ? String(place.distance) : ''
  ]);
  autoTable(doc, {
    head: headers,
    body,
    startY: 58,
    styles: { fontSize: 7 },
    margin: { left: 40, right: 40 }
  });
  const name = options.filename || `maps-restaurants-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
}
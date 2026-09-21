// RFC 4180 quoting, UTF-8 BOM and Shopify's repeated variant/image rows.
export function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || !value) quoted = !quoted;
      else value += c;
    } else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(v => v.trim())) rows.push(row);
      row = []; value = '';
    } else value += c;
  }
  if (quoted) throw new Error('CSV-də bağlanmamış dırnaq var. Faylı yenidən ixrac edin.');
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('CSV-də başlıq və ən azı bir məlumat sətri olmalıdır.');
  const headers = rows.shift().map(v => v.trim());
  if (new Set(headers.map(h => h.toLowerCase())).size !== headers.length) throw new Error('CSV sütun adları təkrarlanır.');
  return rows.map(values => Object.fromEntries(headers.map((key, i) => [key, values[i] || ''])));
}
export function encodeCSV(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let s = String(value ?? '');
    // Keep exported user text from becoming a spreadsheet formula.
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
export function catalogFromCSV(csv, domain = '') {
  const rows = parseCSV(csv);
  if (!('Handle' in rows[0]) || !('Title' in rows[0])) throw new Error('Shopify məhsul CSV-si lazımdır: Handle və Title sütunları tapılmadı.');
  const products = new Map();
  for (const r of rows) {
    const handle = r.Handle.trim(); if (!handle) continue;
    if (!products.has(handle)) products.set(handle, { id: `csv:${handle}`, type: 'product', handle, title: '', descriptionHtml: '', seo: { title: '', description: '' }, images: [], tags: [], status: 'ACTIVE', url: domain ? `${domain}/products/${encodeURIComponent(handle)}` : '', source: 'csv' });
    const p = products.get(handle);
    if (r.Title) {
      p.title = r.Title; p.descriptionHtml = r['Body (HTML)'] || ''; p.vendor = r.Vendor || '';
      p.seo = { title: r['SEO Title'] || '', description: r['SEO Description'] || '' };
      p.tags = (r.Tags || '').split(',').map(t => t.trim()).filter(Boolean);
      p.status = r.Published?.toLowerCase() === 'false' ? 'UNPUBLISHED' : (r.Status || 'ACTIVE').toUpperCase();
    }
    if (r['Image Src'] && !p.images.some(im => im.url === r['Image Src'])) p.images.push({ url: r['Image Src'], altText: r['Image Alt Text'] || '' });
  }
  const pages = [...products.values()].filter(p => p.title);
  if (!pages.length) throw new Error('CSV-də başlığı olan məhsul tapılmadı.');
  return pages;
}

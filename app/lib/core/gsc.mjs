import { parseCSV } from './csv.mjs';
const number = (v, name) => {
  const n = Number(String(v).replaceAll(',', '').replace('%', '').trim());
  if (!String(v).trim() || !Number.isFinite(n) || n < 0) throw new Error(`Search Console: ${name} rəqəmi düzgün deyil.`);
  return n;
};
export function importGSC(csv, { startDate, endDate, property }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') || !Number.isFinite(Date.parse(startDate)) || !Number.isFinite(Date.parse(endDate)) || new Date(startDate).toISOString().slice(0,10)!==startDate || new Date(endDate).toISOString().slice(0,10)!==endDate || startDate > endDate) throw new Error('Hesabatın düzgün başlanğıc və bitmə tarixlərini seçin.');
  if (!property?.trim()) throw new Error('Search Console property ünvanını daxil edin.');
  const input = parseCSV(csv), keys = Object.keys(input[0]);
  const find = variants => keys.find(k => variants.includes(k.toLowerCase()));
  const pageKey = find(['top pages', 'page', 'pages']), queryKey = find(['top queries', 'query', 'queries']);
  const clickKey = find(['clicks']), impressionKey = find(['impressions']), positionKey = find(['position']);
  if ((!pageKey && !queryKey) || !clickKey || !impressionKey || !positionKey) throw new Error('İngiliscə Search Console Pages və ya Queries CSV-si seçin. Clicks, Impressions və Position sütunları tələb olunur.');
  const rows = input.map(r => {
    const clicks = number(r[clickKey], 'Clicks'), impressions = number(r[impressionKey], 'Impressions'), position = number(r[positionKey], 'Position');
    if (!Number.isInteger(clicks) || !Number.isInteger(impressions) || clicks > impressions) throw new Error('Clicks və Impressions tam ədəd olmalı, kliklər görünmələri keçməməlidir.');
    const page = pageKey ? r[pageKey].trim() : '';
    if (page && !/^https?:\/\//i.test(page)) throw new Error('Page sütununda tam HTTP(S) ünvanı olmalıdır.');
    return { page, query: queryKey ? r[queryKey].trim() : '', clicks, impressions, ctr: impressions ? clicks / impressions : 0, position };
  });
  const grain = pageKey && queryKey ? 'page-query' : pageKey ? 'page' : 'query';
  const identities = rows.map(r => JSON.stringify([r.page, r.query]));
  if (new Set(identities).size !== identities.length) throw new Error('CSV-də eyni səhifə/sorğu təkrarlanır. Tək hesabat ixracı istifadə edin.');
  return { startDate, endDate, property: property.trim().replace(/\/$/, ''), grain, rows, importedAt: new Date().toISOString(), source: 'csv' };
}
export function summarizeGSC(report, previous) {
  if (!report) return null;
  const totals = r => {
    const clicks = r.rows.reduce((a, v) => a + v.clicks, 0), impressions = r.rows.reduce((a, v) => a + v.impressions, 0);
    return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? r.rows.reduce((a, v) => a + v.position * v.impressions, 0) / impressions : null };
  };
  const current = totals(report);
  const days = r => (Date.parse(r.endDate) - Date.parse(r.startDate)) / 86400000 + 1;
  const comparable = previous && report.property === previous.property && report.grain === previous.grain && (report.country||'unknown') === (previous.country||'unknown') && (report.device||'unknown') === (previous.device||'unknown') && (report.searchType||'unknown') === (previous.searchType||'unknown') && report.source===previous.source && days(report) === days(previous) && previous.endDate < report.startDate;
  return { ...report, totals: current, comparison: comparable ? { previous: totals(previous), startDate: previous.startDate, endDate: previous.endDate } : null,
    opportunities: report.rows.filter(r => r.impressions >= 100 && r.position >= 3 && r.position <= 20 && r.ctr < .03).sort((a, b) => b.impressions - a.impressions),
    note: `${report.country==='usa'?'ABŞ · bütün cihazlar · Web axtarışı. ':''}${report.truncated?'Sətir limiti dolub; hesabat natamam ola bilər. ':''}` + 'Cəmlər yalnız idxal edilmiş sətirlərə aiddir. Sorğu anonimləşdirilməsi və ixrac limitləri səbəbindən Search Console ümumi nəticəsindən fərqlənə bilər. 3% CTR prioritetləşdirmə filtridir, universal norma deyil.' };
}

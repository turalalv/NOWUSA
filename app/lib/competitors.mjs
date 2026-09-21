const allowed = new Set(['sweatblock.com', 'certaindri.com']);
const text = (value, max = 1000) => typeof value === 'string' ? value.slice(0, max) : '';

export function importCompetitor(state, raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 2_500_000) throw new Error('JSON faylı maksimum 2.5 MB olmalıdır.');
  let rows;
  try { rows = JSON.parse(raw); } catch { throw new Error('Düzgün pages.json faylı seçin.'); }
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('Faylda 1–500 səhifə olmalıdır.');
  let domain;
  const seen = new Set();
  const pages = rows.map(row => {
    if (!row || typeof row !== 'object') throw new Error('Səhifə məlumatı düzgün deyil.');
    let url;
    try { url = new URL(row.url); } catch { throw new Error('Səhifə URL-i düzgün deyil.'); }
    const host = url.hostname.replace(/^www\./, '');
    if (!allowed.has(host) || url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Yalnız SweatBlock və Certain Dri HTTPS səhifələri qəbul edilir.');
    if (domain && domain !== host) throw new Error('Hər dəfə yalnız bir saytın pages.json faylını import edin.');
    domain = host;
    url.hostname = host; url.hash = '';
    if (seen.has(url.href)) throw new Error('Faylda təkrarlanan səhifə URL-i var.');
    seen.add(url.href);
    if (row.status !== 200 || !Array.isArray(row.extracted_keywords)) throw new Error('Scraper-in uğurlu səhifə nəticələri tələb olunur.');
    const keywords = row.extracted_keywords.slice(0, 100).map(k => {
      if (!k || typeof k.keyword !== 'string' || !k.keyword.trim() || !Number.isSafeInteger(k.count) || k.count < 1) throw new Error('Açar söz məlumatı düzgün deyil.');
      return {keyword: k.keyword.trim().toLowerCase().slice(0, 160), count: k.count};
    });
    const internalLinks = Array.isArray(row.internal_links) ? [...new Set(row.internal_links.filter(link=>{
      try {const u=new URL(link);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname.replace(/^www\./,'')===host;}catch{return false;}
    }))].slice(0,500) : [];
    return {url: url.href, title: text(row.title), description: text(row.meta_description), internalLinks,
      metaKeywords: text(row.meta_keywords), keywords,
      headings: Array.isArray(row.headings) ? row.headings.filter(h => h && /^h[1-6]$/.test(h.level)).slice(0, 100).map(h => ({level: h.level, text: text(h.text)})) : [],
      issues: Array.isArray(row.issues) ? row.issues.slice(0, 30).map(x => text(x, 100)) : [],
      scrapedAt: text(row.scraped_at, 100)};
  });
  const report = {domain, importedAt: new Date().toISOString(), pages};
  state.competitors = {...state.competitors, [domain]: report};
  return report;
}

export function competitorKeywords(reports) {
  const map = new Map();
  for (const report of Object.values(reports || {})) for (const page of report.pages) {
    const pageWords = new Set();
    for (const word of page.keywords) {
      const item = map.get(word.keyword) || {keyword: word.keyword, count: 0, pages: 0, domains: new Set()};
      item.count += word.count;
      if (!pageWords.has(word.keyword)) item.pages++;
      pageWords.add(word.keyword);
      item.domains.add(report.domain);
      map.set(word.keyword, item);
    }
  }
  return [...map.values()].map(x => ({...x, domains: [...x.domains]})).sort((a,b) => b.count-a.count || a.keyword.localeCompare(b.keyword));
}

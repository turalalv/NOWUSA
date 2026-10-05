import {pacificDate, pageKey, changeEffects} from './growth.mjs';
import {searchMetrics} from './search-reports.mjs';

export const shiftDay = (date, offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);

// The most recent complete Monday–Sunday with three days left for GSC finalization.
export function weeklyWindow(now = new Date()) {
  const available = shiftDay(pacificDate(now), -3);
  const weekday = new Date(`${available}T00:00:00Z`).getUTCDay();
  const end = shiftDay(available, -weekday);
  return {start: shiftDay(end, -6), end, previousStart: shiftDay(end, -13), previousEnd: shiftDay(end, -7)};
}

export function reportSettings(state) {
  return {auto: false, email: false, recipient: '', ...state.weekly?.settings};
}

export function saveReportSettings(state, input) {
  const recipient = String(input.recipient || '').trim();
  if (recipient && (recipient.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient))) throw new Error('Geçerli bir alıcı e-posta adresi girin.');
  if (input.email === 'true' && !recipient) throw new Error('Otomatik gönderim için alıcı adresi gereklidir.');
  state.weekly ||= {reports: []};
  state.weekly.settings = {auto: input.auto === 'true', email: input.email === 'true', recipient};
}

export function metricChange(current, previous) {
  if (current == null || previous == null) return null;
  return {absolute: current - previous, percent: previous === 0 ? null : (current - previous) / previous * 100};
}

function trafficSummary(reports, window, country) {
  const get = (grain, start, end) => reports.find(r => r.grain === grain && r.country === country && r.startDate === start && r.endDate === end);
  const current = searchMetrics(get('property', window.start, window.end));
  const previous = searchMetrics(get('property', window.previousStart, window.previousEnd));
  const pages = get('page', window.start, window.end), oldPages = get('page', window.previousStart, window.previousEnd);
  const previousRows = new Map((oldPages?.rows || []).map(r => [r.page, r]));
  return {current, previous, clicks: metricChange(current?.clicks, previous?.clicks), impressions: metricChange(current?.impressions, previous?.impressions),
    limited: Boolean(pages?.truncated || oldPages?.truncated), pageCount: pages?.rows.length || 0,
    pages: [...(pages?.rows || [])].sort((a,b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 200).map(r => ({...r, previousClicks: previousRows.get(r.page)?.clicks ?? null}))};
}

export function buildWeeklyReport({state, reports, changes, sales, window, now = new Date()}) {
  const completed = changes.filter(c => c.status === 'applied' && pacificDate(c.createdAt) >= window.start && pacificDate(c.createdAt) <= window.end);
  const effects = changeEffects({...state, growth: {...state.growth, reports}}, changes);
  return {id: `week-${window.end}`, ...window, generatedAt: now.toISOString(), name: state.catalog.shop.name,
    property: reports[0]?.property || '', timezone: 'America/Los_Angeles',
    traffic: {all: trafficSummary(reports, window, 'all'), usa: trafficSummary(reports, window, 'usa')},
    sales, changes: completed.map(c => ({id: c.id, pageTitle: c.pageTitle, date: pacificDate(c.createdAt)})), effects,
    notes: ['Google: Web araması, tüm cihazlar; haftalar Pazartesi–Pazar, Pasifik saatine göre.',
      'Sayfa satırları gizlilik ve API sınırları nedeniyle site toplamlarından farklı olabilir. Eksik satır sıfır sayılmaz.',
      'Düzenleme öncesi/sonrası tıklama farkı gözlemdir; düzenlemenin sonucu tek başına kanıtlanamaz.',
      'Satışlar: tüm ülkeler, Shopify tarafından SEO olarak işaretlenen son ziyaretin giriş sayfası. Search Console tıklamaları siparişlerle kişi bazında eşleştirilmez.']};
}

export function saveWeeklyReport(state, report) {
  state.weekly ||= {reports: []};
  state.weekly.reports = [...(state.weekly.reports || []).filter(r => r.id !== report.id), report]
    .sort((a,b) => b.end.localeCompare(a.end)).slice(0, 26);
}

export function weeklyData(state) {
  return {settings: reportSettings(state), reports: state.weekly?.reports || []};
}

// A source name alone (e.g. Google) does not distinguish paid ads from SEO.
export function attributedLanding(journey) {
  if (!journey?.ready || !journey.lastVisit) return {kind: 'unknown', path: null};
  const visit = journey.lastVisit;
  if (!visit.sourceType) return {kind: 'unknown', path: null};
  if (visit.sourceType !== 'SEO') return {kind: 'other', path: null};
  const path = pageKey(visit.landingPage);
  return {kind: path ? 'seo' : 'unknown', path};
}

export function summarizeOrders(orders, window, limited = false) {
  const blank = () => ({eligible: 0, attributed: 0, unknown: 0, other: 0, amounts: {}, pages: []});
  const current = blank(), previous = blank(), seen = new Set();
  for (const order of orders) {
    if (seen.has(order.id) || order.test || order.cancelledAt || !['PAID','PARTIALLY_REFUNDED','REFUNDED'].includes(order.displayFinancialStatus)) continue;
    seen.add(order.id);
    const date = pacificDate(order.createdAt);
    const target = date >= window.start && date <= window.end ? current : date >= window.previousStart && date <= window.previousEnd ? previous : null;
    if (!target) continue;
    target.eligible++;
    const match = attributedLanding(order.customerJourneySummary);
    const money = order.currentTotalPriceSet?.shopMoney;
    const amount = Number(money?.amount);
    if (match.kind === 'unknown' || !money || !Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(money.currencyCode)) {target.unknown++; continue;}
    if (match.kind === 'other') {target.other++; continue;}
    target.attributed++;
    const currency = money.currencyCode;
    target.amounts[currency] = (target.amounts[currency] || 0) + amount;
    let page = target.pages.find(p => p.path === match.path && p.currency === currency);
    if (!page) {page = {path: match.path, currency, orders: 0, amount: 0}; target.pages.push(page);}
    page.orders++; page.amount += amount;
  }
  for (const period of [current, previous]) {
    period.amounts = Object.fromEntries(Object.entries(period.amounts).map(([currency, amount]) => [currency, Math.round(amount * 100) / 100]));
    period.pages.sort((a,b) => b.orders - a.orders || a.path.localeCompare(b.path));
    for (const p of period.pages) p.amount = Math.round(p.amount * 100) / 100;
  }
  return {status: limited ? 'limited' : 'available', current, previous, limited,
    note: 'Ödenmiş / iade edilmiş, test olmayan ve iptal edilmemiş siparişler. Tutar: rapor anındaki Shopify güncel sipariş toplamı (vergi/kargo dahil), net kâr değildir. Sonradan yapılan iadeler için raporu yenileyin. Bilinmeyen ziyaretler SEO sayılmaz.'};
}

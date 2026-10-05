import crypto from 'node:crypto';
import {fetchWeeklyGoogle} from './weekly-google.server.mjs';
import {weeklyWindow, buildWeeklyReport, saveWeeklyReport, summarizeOrders, shiftDay} from './weekly-reports.mjs';

export const WEEKLY_ORDERS_QUERY = `query WeeklySeoOrders($after: String, $query: String!) {
  orders(first: 50, after: $after, query: $query, sortKey: CREATED_AT) {
    nodes {
      id createdAt test cancelledAt displayFinancialStatus
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customerJourneySummary { ready lastVisit { sourceType landingPage } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

export async function fetchWeeklySales(admin, window) {
  // Query a broad UTC envelope, then apply exact Pacific dates (including DST) locally.
  const query = `created_at:>=${window.previousStart} created_at:<${shiftDay(window.end, 2)}`;
  const orders = [], cursors = new Set(); let after = null, limited = false;
  for (let i = 0; i < 40; i++) {
    const response = await admin.graphql(WEEKLY_ORDERS_QUERY, {variables: {query, after}});
    const result = await response.json();
    if (!response.ok || result.errors?.length || !Array.isArray(result.data?.orders?.nodes)) throw new Error('Sipariş raporu alınamadı. read_orders ve müşteri yolculuğu erişimini kontrol edin.');
    const batch = result.data.orders;
    orders.push(...batch.nodes);
    if (!batch.pageInfo.hasNextPage) break;
    after = batch.pageInfo.endCursor;
    if (!after || cursors.has(after)) throw new Error('Shopify sipariş sayfalaması tamamlanamadı.');
    cursors.add(after);
    if (i === 39) limited = true;
  }
  return summarizeOrders(orders, window, limited);
}

export async function generateWeeklyReport({db, shop, state, admin, canReadOrders, now = new Date(), google = fetchWeeklyGoogle, salesFetcher = fetchWeeklySales}) {
  const window = weeklyWindow(now);
  const reports = await google(db, shop, window);
  let sales = {status: 'unavailable', current: null, previous: null, note: 'Satış raporu için uygulamaya read_orders izni verilmelidir.'};
  if (canReadOrders) {
    try {sales = await salesFetcher(admin, window);}
    catch {sales.note = 'Shopify sipariş / müşteri yolculuğu verileri alınamadı. İzinleri kontrol edip raporu yenileyin.';}
  }
  const changes = await db.seoChange.findMany({where: {shop, status: 'applied'}, orderBy: {createdAt: 'desc'}, take: 200});
  const report = buildWeeklyReport({state, reports, changes, sales, window, now});
  saveWeeklyReport(state, report);
  return report;
}

export function emailConfigured() {return Boolean(process.env.RESEND_API_KEY && process.env.REPORT_EMAIL_FROM);}
export function deliveryId(shop, reportId, recipient) {return crypto.createHash('sha256').update(JSON.stringify([shop, reportId, recipient.toLowerCase()])).digest('hex');}

export async function sendWeeklyEmail({db, shop, report, recipient, fetcher = fetch, pdfFactory}) {
  if (!emailConfigured()) throw new Error('E-posta gönderimi henüz yapılandırılmadı.');
  if (!recipient || /[\r\n,;<>]/.test(recipient)) throw new Error('Alıcı adresini kaydedin.');
  const id = deliveryId(shop, report.id, recipient);
  const existing = await db.seoReportDelivery.findUnique({where: {id}});
  if (existing?.status === 'sent') return 'Bu haftanın raporu bu alıcıya zaten gönderildi.';
  if (existing && existing.status !== 'failed') throw new Error('Önceki gönderimin sonucu belirsiz. Yeniden göndermeden önce e-posta sağlayıcısında kontrol edin.');
  const {reportPDF, reportEmail} = await import('./weekly-report-export.server.mjs');
  const pdf = await (pdfFactory || reportPDF)(report);
  // Durable reservation before the external side effect. A crash never causes a blind resend.
  if (existing) {
    const claimed = await db.seoReportDelivery.updateMany({where: {id, status: 'failed'}, data: {status: 'pending'}});
    if (!claimed.count) throw new Error('Rapor gönderimi başka bir işlem tarafından başlatıldı.');
  } else await db.seoReportDelivery.create({data: {id, shop, reportId: report.id, status: 'pending'}});
  let response;
  try {
    response = await fetcher('https://api.resend.com/emails', {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': id},
      body: JSON.stringify({from: process.env.REPORT_EMAIL_FROM, to: [recipient], subject: `No Sweat SEO · ${report.start} – ${report.end}`, html: reportEmail(report),
        attachments: [{filename: `no-sweat-seo-${report.end}.pdf`, content: pdf.toString('base64')}]})});
    if (!response.ok) {
      // Only definitive rejection can be retried. Timeouts/server errors remain uncertain.
      const status = [400,401,403,404,422,429].includes(response.status) ? 'failed' : 'unknown';
      await db.seoReportDelivery.update({where: {id}, data: {status}});
      throw new Error('E-posta sağlayıcısı gönderimi tamamlayamadı.');
    }
    const result = await response.json();
    if (!result.id) throw new Error('E-posta gönderimi doğrulanamadı.');
    await db.seoReportDelivery.update({where: {id}, data: {status: 'sent', providerId: result.id}});
    return 'Haftalık rapor PDF ekiyle e-posta sağlayıcısına teslim edildi.';
  } catch (error) {
    await db.seoReportDelivery.updateMany({where: {id, status: 'pending'}, data: {status: 'unknown'}});
    throw error;
  }
}

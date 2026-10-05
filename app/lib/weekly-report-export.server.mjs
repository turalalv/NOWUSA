import PDFDocument from 'pdfkit';
import path from 'node:path';

const fmt = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString('tr-TR', {maximumFractionDigits: digits});
const money = amounts => Object.entries(amounts || {}).map(([currency, amount]) => `${fmt(amount, 2)} ${currency}`).join(' · ') || '—';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function reportEmail(report) {
  const rows = ['all','usa'].map(country => {
    const traffic = report.traffic[country];
    return `<tr><td>${country === 'usa' ? 'ABD' : 'Tüm ülkeler'}</td><td>${fmt(traffic.current?.clicks)}</td><td>${fmt(traffic.previous?.clicks)}</td><td>${fmt(traffic.current?.impressions)}</td></tr>`;
  }).join('');
  return `<html lang="tr"><body style="font-family:Arial,sans-serif;color:#183346;max-width:680px;margin:auto;padding:28px"><h1>No Sweat SEO</h1><h2>Haftalık rapor</h2><p>${escape(report.start)} — ${escape(report.end)}</p><p>Önceki hafta: ${escape(report.previousStart)} — ${escape(report.previousEnd)}</p><table cellpadding="10" style="border-collapse:collapse"><tr><th>Kapsam</th><th>Tıklama</th><th>Önceki</th><th>Gösterim</th></tr>${rows}</table><p>Uygulanan SEO değişikliği: ${report.changes.length}</p><p>SEO ile ilişkilendirilen sipariş: ${report.sales.current ? fmt(report.sales.current.attributed) : 'Veri alınamadı'}. Sipariş tutarı: ${escape(money(report.sales.current?.amounts))}.</p><p>Tam karşılaştırma, satış sayfaları ve değişiklik gözlemleri PDF ekindedir.</p><p style="color:#587082;font-size:12px">${report.notes.map(escape).join('<br>')}</p></body></html>`;
}

export async function reportPDF(report) {
  const document = new PDFDocument({size: 'A4', margin: 46, bufferPages: true, info: {Title: `No Sweat SEO ${report.start} – ${report.end}`, Author: 'No Sweat SEO'}});
  const chunks = [];
  const finished = new Promise((resolve, reject) => {document.on('data', c => chunks.push(c));document.on('end', () => resolve(Buffer.concat(chunks)));document.on('error', reject);});
  document.font(path.join(process.cwd(), 'public/fonts/DejaVuSans.ttf'));
  const space = height => {if (document.y + height > document.page.height - 65) document.addPage();};
  const heading = text => {space(65); document.moveDown(.6).fontSize(15).fillColor('#116b91').text(text).moveDown(.5);};
  const line = text => {space(44);document.fontSize(10).fillColor('#243b4a').text(text, {lineGap: 4}).moveDown(.4);};
  document.fontSize(24).fillColor('#17384b').text('No Sweat SEO');
  heading('Haftalık SEO raporu');
  line(`${report.start} — ${report.end} · Pasifik saati`);
  line(`Önceki hafta: ${report.previousStart} — ${report.previousEnd}`);
  line(`Hazırlanma: ${report.generatedAt} · ${report.property}`);
  for (const country of ['all','usa']) {
    const t = report.traffic[country];
    heading(country === 'usa' ? 'Google · ABD' : 'Google · Tüm ülkeler');
    line(`Tıklama: ${fmt(t.current?.clicks)}  |  Önceki: ${fmt(t.previous?.clicks)}  |  Fark: ${fmt(t.clicks?.absolute)}`);
    line(`Gösterim: ${fmt(t.current?.impressions)}  |  Önceki: ${fmt(t.previous?.impressions)}`);
    line(`CTR: %${fmt(t.current?.ctr * 100, 2)}  |  Ortalama konum: ${fmt(t.current?.position, 1)}`);
    if (t.limited) line('Sayfa raporunda satır sınırına ulaşıldı.');
    line(`En çok tıklanan ${Math.min(t.pages.length, 10)} sayfa (detay: ${t.pageCount} satır):`);
    for (const p of t.pages.slice(0, 10)) line(`${p.page}\n${fmt(p.clicks)} tıklama · önceki ${fmt(p.previousClicks)} · ${fmt(p.impressions)} gösterim`);
  }
  heading('SEO ile ilişkilendirilen satışlar · Tüm ülkeler');
  line(report.sales.note);
  if (report.sales.current) {
    const s = report.sales;
    if(s.limited) line('Sipariş sınırına ulaşıldı: satış toplamları eksiktir.');
    line(`SEO siparişi: ${s.current.attributed} · Önceki: ${s.previous.attributed}`);
    line(`Sipariş tutarı: ${money(s.current.amounts)} · Önceki: ${money(s.previous.amounts)}`);
    line(`İncelenen uygun sipariş: ${s.current.eligible} · Kaynak bilinmiyor: ${s.current.unknown} · Diğer kaynak: ${s.current.other}`);
    for (const p of s.current.pages) line(`${p.path}\n${p.orders} sipariş · ${fmt(p.amount,2)} ${p.currency}`);
  }
  heading('Bu hafta uygulanan değişiklikler');
  if (!report.changes.length) line('Bu hafta uygulamada kaydedilmiş SEO değişikliği yok.');
  for (const c of report.changes) line(`${c.date} · ${c.pageTitle}`);
  heading('Değişiklik öncesi / sonrası · ABD');
  if (!report.effects.length) line('Karşılaştırılabilecek kayıtlı SEO değişikliği yok.');
  for (const e of report.effects) {
    line(`${e.pageTitle} · ${e.changed}`);
    line(`${e.beforeStart}–${e.beforeEnd}: ${fmt(e.before?.clicks)} tıklama\n${e.afterStart}–${e.afterEnd}: ${fmt(e.after?.clicks)} tıklama`);
    line(e.reason);
  }
  heading('Kaynaklar ve yöntem');
  report.notes.forEach(line);
  const range = document.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {document.switchToPage(i);document.fontSize(8).fillColor('#687d8a').text(`No Sweat SEO · ${i + 1} / ${range.count}`, 46, document.page.height - 40, {lineBreak: false});}
  document.end();
  return finished;
}

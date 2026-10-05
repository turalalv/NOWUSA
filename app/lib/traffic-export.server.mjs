import PDFDocument from 'pdfkit';
import path from 'node:path';
export function trafficPDF(report){
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margin:44,info:{Title:`No Sweat USA ziyaretçi raporu ${report.start} — ${report.end}`,Author:'No Sweat SEO'}}),chunks=[];
  doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  doc.font(path.join(process.cwd(),'public/fonts/DejaVuSans.ttf'));
  const text=(s,size=10)=>{if(doc.y>730)doc.addPage();doc.fontSize(size).fillColor('#263d31').text(String(s),{lineGap:3});doc.moveDown(.4);};
  const heading=s=>{if(doc.y>680)doc.addPage();doc.moveDown();text(s,15);};
  text('No Sweat USA · Ziyaretçi analitiği',21);text(`${report.start} — ${report.end} · ${report.timeZone}`);text(`Kaynak: GA4 · ${report.name} · ${report.property}`);text(`Güncelleme: ${report.generatedAt}`);
  if(report.partial)text('Bugünün verisi tamamlanmamıştır.');
  if(Object.values(report.quality).some(Boolean))text('Bu raporda satır sınırı, gizlilik eşiği, örnekleme veya (other) gruplaması bulunabilir; detaylar eksik olabilir.');
  heading('Genel toplamlar');
  for(const [key,label]of [['sessions','Ziyaret (oturum)'],['totalUsers','Ziyaretçi (GA4 kullanıcısı)'],['screenPageViews','Sayfa görüntüleme']])text(`${label}: ${report.current[key]} · Önceki: ${report.previous[key]}`);
  text(`Önceki dönem: ${report.previousStart} — ${report.previousEnd}`);
  heading('Günlük ziyaretler');for(const r of report.daily)text(`${r.date} · ${r.sessions} ziyaret · ${r.totalUsers} kullanıcı · ${r.screenPageViews} görüntüleme`);
  heading('Ülkeler · İlk 20');for(const r of report.countries.slice(0,20))text(`${r.country} (${r.countryId}) · ${r.sessions} ziyaret · ${r.totalUsers} kullanıcı`);
  heading('Kaynak / kampanya / ülke · İlk 20');for(const r of report.sources.slice(0,20))text(`${r.label} · ${r.sessionSource} / ${r.sessionMedium}\n${r.sessionCampaignName} · ${r.country} (${r.countryId}) · ${r.sessions} ziyaret`);
  heading('Görüntülenen ürünler · İlk 20');if(!report.products.length)text('Bu dönemde ölçülmüş ürün sayfası görüntülemesi yok.');for(const r of report.products.slice(0,20))text(`${r.title}\n${r.path}\n${r.label} · ${r.sessionCampaignName} · ${r.country} (${r.countryId}) · ${r.screenPageViews} sayfa görüntüleme`);
  heading('Ölçüm notları');text('Ürün görüntülemeleri ürün sayfası görüntülemeleridir; tekrar ziyaretler dahildir. Kaynak, GA4 oturum kaynağıdır. Kullanıcılar detay satırlarında tekrar edebilir; kullanıcı satırları toplanmaz.');text('Direct kaynağı belirlenemeyen girişleri de içerir. Reklam / organik ayrımı GA4 kanal bilgisi ve ölçülen etiketlere bağlıdır. Son günler güncellenebilir; izin verilmeyen veya engellenen ölçümler eksik olabilir.');text('PDF tüm siteyi kapsar. Ekrandaki ülke/kaynak filtreleri PDF özetine uygulanmaz. Ayrıntılı satırlar uygulamada görüntülenir.');
  doc.end();
 });
}

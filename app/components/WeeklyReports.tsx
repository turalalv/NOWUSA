import {useState} from 'react';
import type {ActionInput, GrowthEffect, GrowthMetric} from '../lib/types';
import './weekly-reports.css';

type Traffic = {current:GrowthMetric|null;previous:GrowthMetric|null;limited:boolean;pageCount:number;pages:{page:string;clicks:number;previousClicks:number|null;impressions:number}[]};
type SalesPeriod = {eligible:number;attributed:number;unknown:number;other:number;amounts:Record<string,number>;pages:{path:string;orders:number;amount:number;currency:string}[]};
export type WeeklyReport = {id:string;start:string;end:string;previousStart:string;previousEnd:string;generatedAt:string;property:string;traffic:{all:Traffic;usa:Traffic};sales:{status:string;note:string;limited?:boolean;current:SalesPeriod|null;previous:SalesPeriod|null};changes:{id:string;pageTitle:string;date:string}[];effects:GrowthEffect[];notes:string[]};
export type WeeklyReportData = {settings:{auto:boolean;email:boolean;recipient:string};reports:WeeklyReport[];emailConfigured:boolean;canReadOrders:boolean;deliveries:{reportId:string;status:string;updatedAt:string|Date}[]};
type Props = {data?:WeeklyReportData;busy:boolean;onAction:(input:ActionInput)=>void};
const fmt=(n:number|null|undefined,digits=0)=>n==null?'—':n.toLocaleString('tr-TR',{maximumFractionDigits:digits});
const money=(values:Record<string,number>|undefined)=>Object.entries(values||{}).map(([currency,amount])=>`${fmt(amount,2)} ${currency}`).join(' · ')||'—';
function delta(a:number|null|undefined,b:number|null|undefined){if(a==null||b==null)return 'Karşılaştırma yok';const d=a-b;return `${d>0?'+':''}${fmt(d,2)}${b?` (${d>0?'+':''}${fmt(d/b*100,1)}%)`:b===0&&a!==0?' · önceki değer 0':''}`;}

function Settings({data,busy,onAction}:Required<Props>){
 const [auto,setAuto]=useState(data.settings.auto),[email,setEmail]=useState(data.settings.email),[recipient,setRecipient]=useState(data.settings.recipient);
 return <details className="studio-details"><summary>Haftalık rapor ve e-posta ayarları</summary><div className="weekly-settings">
  <label><input type="checkbox" checked={auto} disabled={busy} onChange={e=>setAuto(e.target.checked)}/> Her hafta otomatik rapor hazırla</label>
  <p>Son tamamlanmış Pazartesi–Pazar haftası kullanılır. Google verilerinin kesinleşmesi için üç gün beklenir. Sunucunun günlük zamanlayıcısı çalıştığında rapor bir kez hazırlanır.</p>
  <label className="weekly-email-label">Alıcı e-posta adresi<input type="email" maxLength={254} value={recipient} disabled={busy} onChange={e=>setRecipient(e.target.value)} placeholder="ornek@magazaniz.com"/></label>
  <label><input type="checkbox" checked={email} disabled={busy||!data.emailConfigured} onChange={e=>setEmail(e.target.checked)}/> Hazırlanan raporu bu adrese PDF ekiyle otomatik gönder</label>
  {!data.emailConfigured&&<p>E-posta gönderimi henüz yapılandırılmadı. PDF dosyasını indirebilirsiniz.</p>}
  <s-button disabled={busy} onClick={()=>onAction({intent:'weekly-settings',auto:String(auto),email:String(email),recipient})}>Ayarları kaydet</s-button>
 </div></details>;
}

export default function WeeklyReports({data,busy,onAction}:Props){
 const [selected,setSelected]=useState(''),[country,setCountry]=useState<'all'|'usa'>('all'),[confirm,setConfirm]=useState('');
 if(!data)return <s-section><s-paragraph>Haftalık raporları mağaza sahibi veya yetkilendirilmiş yönetici görüntüleyebilir.</s-paragraph></s-section>;
 const report=data.reports.find(r=>r.id===selected)||data.reports[0];
 const traffic=report?.traffic[country];
 const delivery=data.deliveries.find(d=>d.reportId===report?.id);
 return <div className="weekly-report">
  <section className="analytics-card weekly-intro"><div><h2>Haftanın SEO sonuçları</h2><p>Google aramaları, uygulanan düzenlemeler ve SEO ile ilişkilendirilen siparişler tek raporda.</p></div><s-button variant="primary" disabled={busy} onClick={()=>onAction({intent:'weekly-generate'})}>{busy?'Hazırlanıyor…':'Son haftanın raporunu hazırla / yenile'}</s-button></section>
  <Settings key={JSON.stringify(data.settings)} data={data} busy={busy} onAction={onAction}/>
  {!data.canReadOrders&&<s-banner tone="info">Satış verileri için uygulamaya read_orders izni verilmesi gerekir. Google ve PDF raporları kullanılabilir.</s-banner>}
  {!report?<section className="analytics-card"><h2>İlk haftalık raporunuzu hazırlayın</h2><p>Google bağlantınızdan gerçek veriler alınır. Raporlar 26 hafta saklanır; veri bulunamayan bölümler açıkça belirtilir.</p></section>:<>
   <section className="analytics-card"><div className="weekly-toolbar"><label>Rapor haftası<select value={report.id} onChange={e=>{setSelected(e.target.value);setConfirm('');}}>{data.reports.map(r=><option key={r.id} value={r.id}>{r.start} — {r.end}</option>)}</select></label><label>Google kapsamı<select value={country} onChange={e=>setCountry(e.target.value as 'all'|'usa')}><option value="all">Tüm ülkeler</option><option value="usa">ABD</option></select></label><s-button disabled={busy} onClick={()=>onAction({intent:'weekly-pdf',reportId:report.id})}>PDF indir</s-button><s-button disabled={busy||!data.emailConfigured||!data.settings.recipient} onClick={()=>setConfirm(report.id)}>E-posta gönder</s-button></div>
   <p>{report.start} — {report.end} · Önceki: {report.previousStart} — {report.previousEnd} · Pasifik saati</p><p className="weekly-muted">Hazırlanma: {new Date(report.generatedAt).toLocaleString('tr-TR')} · {report.property}</p>
   {delivery&&<p>Son gönderim durumu: {({sent:'Sağlayıcıya teslim edildi',pending:'Gönderiliyor / sonuç bekleniyor',unknown:'Sonuç belirsiz; sağlayıcıda kontrol edin',failed:'Gönderilemedi'} as Record<string,string>)[delivery.status]||delivery.status}</p>}
   {confirm===report.id&&<div className="weekly-confirm"><p><strong>{data.settings.recipient}</strong> adresine bu haftanın raporu ve PDF eki gönderilecek.</p><s-button disabled={busy} variant="primary" onClick={()=>{onAction({intent:'weekly-email',reportId:report.id,confirm:'SEND'});setConfirm('');}}>Onayla ve gönder</s-button> <s-button disabled={busy} onClick={()=>setConfirm('')}>Vazgeç</s-button></div>}
   </section>
   {traffic&&<><div className="weekly-metrics">{[
    {label:'Tıklama',a:traffic.current?.clicks,b:traffic.previous?.clicks},
    {label:'Gösterim',a:traffic.current?.impressions,b:traffic.previous?.impressions},
    {label:'CTR (%)',a:traffic.current?traffic.current.ctr*100:null,b:traffic.previous?traffic.previous.ctr*100:null},
    {label:'Ortalama konum',a:traffic.current?.position,b:traffic.previous?.position},
   ].map(m=><section className="analytics-card" key={m.label}><span>{m.label}</span><strong>{fmt(m.a,2)}</strong><small>Önceki: {fmt(m.b,2)}</small><p>{m.label==='CTR (%)'?`Fark: ${m.a!=null&&m.b!=null?fmt(m.a-m.b,2)+' yüzde puan':'—'}`:delta(m.a,m.b)}</p></section>)}</div>
   <section className="analytics-card"><h2>Google’dan ziyaret alan sayfalar</h2><p className="weekly-muted">Site toplamları ile sayfa detayları farklı olabilir. Eksik önceki satır “—” gösterilir. İlk {traffic.pages.length} / {traffic.pageCount} satır.</p>{traffic.limited&&<s-banner tone="warning">Sayfa verileri API sınırı nedeniyle eksik olabilir.</s-banner>}<div className="weekly-table"><table><thead><tr><th>Sayfa</th><th>Tıklama</th><th>Önceki</th><th>Fark</th><th>Gösterim</th></tr></thead><tbody>{traffic.pages.map(p=><tr key={p.page}><td>{p.page}</td><td>{fmt(p.clicks)}</td><td>{fmt(p.previousClicks)}</td><td>{delta(p.clicks,p.previousClicks)}</td><td>{fmt(p.impressions)}</td></tr>)}</tbody></table></div>{!traffic.pages.length&&<p>Bu raporda sayfa detayı dönmedi.</p>}</section></>}
   <section className="analytics-card"><h2>SEO ile ilişkilendirilen satışlar · Tüm ülkeler</h2><p>{report.sales.note}</p>{report.sales.limited&&<s-banner tone="warning">Sipariş sınırına ulaşıldı; aşağıdaki tutarlar ve sayılar eksiktir.</s-banner>}{report.sales.current&&report.sales.previous&&<>
    <div className="weekly-sales-summary"><div><span>SEO siparişi</span><strong>{fmt(report.sales.current.attributed)}</strong><small>Önceki: {fmt(report.sales.previous.attributed)}</small></div><div><span>Güncel sipariş tutarı</span><strong>{money(report.sales.current.amounts)}</strong><small>Önceki: {money(report.sales.previous.amounts)}</small></div><div><span>Kaynağı bilinmeyen sipariş</span><strong>{fmt(report.sales.current.unknown)}</strong><small>{report.sales.current.eligible} uygun sipariş incelendi</small></div></div>
    <p>Model: Shopify’ın SEO olarak belirlediği son ziyaretin giriş sayfası. Google dışındaki organik aramalar da dahildir. Müşteri bazında Google tıklaması eşleştirilmez.</p>
    <div className="weekly-table"><table><thead><tr><th>Giriş sayfası</th><th>Sipariş</th><th>Tutar</th></tr></thead><tbody>{report.sales.current.pages.map(p=><tr key={p.path+p.currency}><td>{p.path}</td><td>{p.orders}</td><td>{fmt(p.amount,2)} {p.currency}</td></tr>)}</tbody></table></div>{!report.sales.current.pages.length&&<p>Bu hafta doğrulanmış SEO giriş sayfasına bağlanan sipariş bulunamadı.</p>}
   </>}</section>
   <section className="analytics-card"><h2>Bu hafta yapılan SEO çalışmaları</h2>{report.changes.length?<ul>{report.changes.map(c=><li key={c.id}>{c.date} · {c.pageTitle}</li>)}</ul>:<p>Bu hafta uygulamada kaydedilmiş SEO değişikliği yok.</p>}</section>
   <section className="analytics-card"><h2>Düzenlemelerden önce / sonra · ABD</h2><p>Değişiklik günü hariç, önceki ve sonraki 7 gün karşılaştırılır. Trafik farkı tek başına değişikliğin etkisini kanıtlamaz.</p>{report.effects.map(e=><article className="weekly-effect" key={e.id}><h3>{e.pageTitle}</h3><p>Düzenleme: {e.changed}</p><p>Önce ({e.beforeStart} — {e.beforeEnd}): {fmt(e.before?.clicks)} tıklama</p><p>Sonra ({e.afterStart} — {e.afterEnd}): {fmt(e.after?.clicks)} tıklama · Fark: {fmt(e.clickDifference)}</p><p className="weekly-muted">{e.reason}</p></article>)}{!report.effects.length&&<p>Karşılaştırılabilecek kayıtlı SEO değişikliği yok.</p>}</section>
   <details className="studio-details"><summary>Kaynaklar ve hesaplama yöntemi</summary><ul>{report.notes.map(n=><li key={n}>{n}</li>)}</ul></details>
  </>}
 </div>;
}

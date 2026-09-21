import {useEffect, useRef, useState} from 'react';
import {Chart, ArcElement, BarElement, CategoryScale, LinearScale, DoughnutController, BarController, Tooltip} from 'chart.js';
import type {ChartConfiguration} from 'chart.js';
import {selectSearchReports,searchMetrics} from '../lib/search-reports.mjs';
import type {Dashboard} from '../lib/types';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, DoughnutController, BarController, Tooltip);
const colors = ['#a565ef','#21b4e7','#25cfa8','#fa8399','#ffbd57'];
const format = (n:number)=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(n);
function DataChart({config,label}:{config:ChartConfiguration;label:string}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(!canvas.current)return;
    const chart=new Chart(canvas.current,config);
    return ()=>chart.destroy();
  },[config]);
  return <canvas ref={canvas} role="img" aria-label={label}>{label}</canvas>;
}
function ring(values:number[],labels:string[],palette=colors,half=false):ChartConfiguration<'doughnut'>{
  return {type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:palette,borderWidth:0,borderRadius:half?14:6,spacing:half?0:6,hoverOffset:3}]},options:{responsive:true,maintainAspectRatio:false,animation:false,cutout:half?'84%':'76%',rotation:half?-90:0,circumference:half?180:360,plugins:{tooltip:{enabled:true}}}};
}
function bars(values:number[],labels:string[],horizontal=false):ChartConfiguration<'bar'>{
  return {type:'bar',data:{labels,datasets:[{label:horizontal?'Bulgu sayısı':'SEO kontrol puanı',data:values,backgroundColor:horizontal?'#25cfa8':'#21b4e7',borderRadius:12,borderSkipped:false,maxBarThickness:horizontal?24:30}]},options:{responsive:true,maintainAspectRatio:false,animation:false,indexAxis:horizontal?'y':'x',scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#697684',font:{size:11},maxRotation:0},...(horizontal?{beginAtZero:true,ticks:{precision:0,color:'#697684'}}:{})},y:{grid:{display:false},border:{display:false},ticks:{color:'#697684',precision:0,autoSkip:false,font:{size:11}},...(!horizontal?{beginAtZero:true,max:100}:{})}},plugins:{tooltip:{enabled:true}}}};
}
function Legend({items}:{items:{label:string;value:number;color:string}[]}){return <ul className="analytics-legend">{items.map(i=><li key={i.label}><span className="legend-dot" style={{backgroundColor:i.color}}/><span>{i.label}</span><strong>{format(i.value)}</strong></li>)}</ul>;}
export default function AnalyticsOverview({data,onNavigate,onEdit}:{data:Dashboard;onNavigate:(tab:string)=>void;onEdit:(id:string)=>void}){
  const pages=data.catalog.pages, issues=pages.flatMap(p=>p.issues);
  const products=pages.filter(p=>p.type==='product').length,collections=pages.length-products;
  const score=pages.length?Math.round(pages.reduce((s,p)=>s+p.score,0)/pages.length):null;
  const titleCount=pages.filter(p=>p.seo?.title?.trim()).length,descriptionCount=pages.filter(p=>p.seo?.description?.trim()).length;
  const titleRate=pages.length?Math.round(titleCount/pages.length*100):0,descriptionRate=pages.length?Math.round(descriptionCount/pages.length*100):0;
  const ranked=[...pages].sort((a,b)=>a.score-b.score).slice(0,7);
  const categories=[{label:'Başlık',value:issues.filter(i=>i.code.includes('title')).length},{label:'Açıklama',value:issues.filter(i=>i.code.includes('description')||i.code.includes('content')).length},{label:'Görseller',value:issues.filter(i=>i.code.includes('image')||i.code.includes('alt')).length},{label:'Diğer',value:issues.filter(i=>!/(title|description|content|image|alt)/.test(i.code)).length}];
  const [country,setCountry]=useState('all');
  const selected=selectSearchReports(data.googleReports||[],data.google?.property,country).total;
  const report=selected?{...selected,totals:searchMetrics(selected)!}:null;
  const history=[data.drafts.length,data.changes.filter(c=>c.status==='applied').length,data.imageDrafts.length];
  return <div className="analytics-grid">
    <section className="analytics-card analytics-catalog" aria-labelledby="catalog-title"><h2 id="catalog-title">Katalog dağılımı</h2><p className="analytics-caption">Mağazanızın SEO çalışma alanı</p>
      {pages.length?<><div className="analytics-donut"><DataChart config={ring([products,collections],['Ürünler','Koleksiyonlar'],[colors[1],colors[0]])} label={`${products} ürün, ${collections} koleksiyon`}/><div className="chart-center"><strong>{pages.length}</strong><span>sayfa</span></div></div><Legend items={[{label:'Ürünler',value:products,color:colors[1]},{label:'Koleksiyonlar',value:collections,color:colors[0]}]}/><div className="catalog-stats"><div><strong>{issues.length}</strong><span>SEO bulgusu</span></div><div><strong>{data.drafts.length}</strong><span>taslak</span></div></div></>:<div className="analytics-empty"><s-icon type="collection"/><strong>Kataloğunuzu tanıyalım</strong><p>İlk kontrol için “Kataloğu kontrol et” düğmesine basın.</p></div>}
      <button className="analytics-link" onClick={()=>onNavigate('Sayfalar')}>Tüm sayfaları incele <s-icon type="arrow-right"/></button>
    </section>
    <section className="analytics-card analytics-performance"><div className="analytics-card-heading"><div><h2>Sayfa performansı</h2><p className="analytics-caption">Önce en düşük puanlı {ranked.length} sayfa · 100 üzerinden</p></div><span className="analytics-tag">Katalog SEO</span></div>
      {ranked.length?<><div className="analytics-bars"><DataChart config={bars(ranked.map(p=>p.score),ranked.map((_,i)=>`S${i+1}`))} label={ranked.map((p,i)=>`S${i+1}: ${p.title}, ${p.score} puan`).join('; ')}/></div><div className="analytics-page-key">{ranked.map((p,i)=><button key={p.id} onClick={()=>onEdit(p.id)} title={p.title}><b>S{i+1}</b> {p.title}</button>)}</div></>:<div className="analytics-empty">Sayfa puanları katalog kontrolünden sonra görünür.</div>}
    </section>
    <section className="analytics-card analytics-coverage"><h2>SEO kapsamı</h2><p className="analytics-caption">Özel metni bulunan sayfalar</p>
      {pages.length?<div className="coverage-rings">{[{label:'Başlık',rate:titleRate,count:titleCount,color:colors[2]},{label:'Meta açıklama',rate:descriptionRate,count:descriptionCount,color:colors[3]}].map(item=><div className="coverage-ring" key={item.label}><DataChart config={ring([item.rate,100-item.rate],[item.label,'Eksik'],[item.color,'#e8f1f5'],true)} label={`${item.label}: ${item.count}/${pages.length} sayfa, yüzde ${item.rate}`}/><div className="chart-center"><strong>%{item.rate}</strong><span>{item.label}</span></div></div>)}</div>:<div className="analytics-empty">Katalog henüz kontrol edilmedi.</div>}
    </section>
    <section className="analytics-card analytics-score"><h2>SEO kontrol puanı</h2><p className="analytics-caption">Sayfaların ortalama kontrol sonucu</p><div className="analytics-gauge"><DataChart config={ring([score??0,100-(score??0)],['Kontrol puanı','Kalan'],[colors[0],'#d6ebf1'],true)} label={score===null?'Henüz SEO puanı yok':`Ortalama SEO kontrol puanı: ${score}/100`}/><div className="chart-center"><strong>{score??'—'}<small> / 100</small></strong><span>{score===null?'İlk kontrolü bekliyor':'Katalog ortalaması'}</span></div></div><p className="analytics-note">Uygulamanın kontrol puanıdır; Google sıralaması değildir.</p></section>
    <section className="analytics-card analytics-priorities"><div className="analytics-card-heading"><div><h2>İyileştirme alanları</h2><p className="analytics-caption">Kontrol türüne göre bulgular</p></div><s-icon type="chart-horizontal"/></div>{issues.length?<div className="analytics-horizontal"><DataChart config={bars(categories.map(c=>c.value),categories.map(c=>c.label),true)} label={categories.map(c=>`${c.label}: ${c.value} bulgu`).join('; ')}/></div>:<div className="analytics-empty">{pages.length?'Kontrol edilen kurallarda açık bulgu yok.':'Bulgular ilk kontrolden sonra görünür.'}</div>}<button className="analytics-link" onClick={()=>onNavigate('ABD müşterileri')}>Öncelikli işlere git <s-icon type="arrow-right"/></button></section>
    <section className="analytics-card analytics-google"><h2>Google performansı</h2><label className="analytics-caption">Ülke <select aria-label="Google performansı ülkesi" value={country} onChange={e=>setCountry(e.target.value)}><option value="all">Tüm ülkeler</option><option value="usa">ABD</option></select></label>{report?<><div className="google-stat-row"><div><span>Tıklama</span><strong>{format(report.totals.clicks)}</strong></div><div><span>Gösterim</span><strong>{format(report.totals.impressions)}</strong></div><div><span>CTR</span><strong>%{format(report.totals.ctr*100)}</strong></div></div><p className="analytics-note">{report.startDate} — {report.endDate} · Search Console site toplamı{report.truncated?' · Rapor sınırlı':''}</p></>:<div className="google-connect-empty"><s-icon type="chart-line"/><div><strong>{data.google?.connected?'İlk raporunuzu getirin':'Google verilerini bağlayın'}</strong><p>Gerçek tıklama ve gösterimlerinizi burada takip edin.</p></div></div>}<button className="analytics-link" onClick={()=>onNavigate('Google sonuçları')}>{report?'Raporları aç':'Search Console bağlantısı'} <s-icon type="arrow-right"/></button></section>
    <section className="analytics-card analytics-work"><h2>Çalışma özeti</h2><p className="analytics-caption">Taslaklar ve kayıtlı değişiklikler</p><div className="analytics-work-body">{history.some(Boolean)?<div className="analytics-small-donut"><DataChart config={ring(history,['SEO taslağı','Uygulanan değişiklik','Görsel taslağı'],[colors[0],colors[1],colors[3]])} label={`SEO taslağı: ${history[0]}, uygulanan değişiklik: ${history[1]}, görsel taslağı: ${history[2]}`}/></div>:<s-icon type="clipboard-checklist"/>}<Legend items={[{label:'SEO taslağı',value:history[0],color:colors[0]},{label:'Uygulanan',value:history[1],color:colors[1]},{label:'Görsel taslağı',value:history[2],color:colors[3]}]}/></div><button className="analytics-link" onClick={()=>onNavigate('Geçmiş')}>Geçmişi görüntüle <s-icon type="arrow-right"/></button></section>
  </div>;
}

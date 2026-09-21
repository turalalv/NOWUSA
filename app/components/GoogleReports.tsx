import {useState} from 'react';
import type {Dashboard,SearchReport} from '../lib/types';
import {selectSearchReports,searchMetrics} from '../lib/search-reports.mjs';
const number=(n:number,digits=0)=>n.toLocaleString('tr-TR',{maximumFractionDigits:digits});
export default function GoogleReports({data}:{data:Dashboard}){
 const [country,setCountry]=useState('all'),[period,setPeriod]=useState('current'),[grain,setGrain]=useState('pages'),[limit,setLimit]=useState(50);
 const reports=selectSearchReports(data.googleReports||[],data.google?.property,country,period);
 const total=reports.total,metrics=searchMetrics(total);
 const detail=grain==='queries'?reports.queries:grain==='daily'?reports.daily:reports.pages;
 const rows:SearchReport['rows']=detail?.rows||[];
 return <>
  <s-section heading="Google arama performansı"><div className="seo-form-grid">
   <s-select label="Ülke" value={country} onChange={e=>{setCountry(e.currentTarget.value);setLimit(50);}}><s-option value="all">Tüm ülkeler</s-option><s-option value="usa">ABD</s-option></s-select>
   <s-select label="Dönem" value={period} onChange={e=>{setPeriod(e.currentTarget.value);setLimit(50);}}><s-option value="current">Son tamamlanan 28 gün</s-option><s-option value="previous">Önceki 28 gün</s-option></s-select>
  </div><s-paragraph>Web araması · tüm cihazlar · {country==='usa'?'yalnızca ABD':'tüm ülkeler'}. Kesinleşmiş veriler için son 3 gün dahil edilmez.</s-paragraph></s-section>
  {metrics&&total?<><div className="seo-metrics">{[['Tıklama',number(metrics.clicks)],['Gösterim',number(metrics.impressions)],['CTR',`%${number(metrics.ctr*100,2)}`],['Ortalama konum',metrics.position===null?'—':number(metrics.position,1)]].map(([label,value])=><s-section key={label}><div className="seo-metric"><span>{label}</span><strong>{value}</strong><small>Search Console site toplamı</small></div></s-section>)}</div>
  <s-banner tone="info">{total.property} · {total.startDate} — {total.endDate}<br/>Google API’den alındı. Son yenileme: {new Date(total.importedAt).toLocaleString('tr-TR')}. Satır detayları ile site toplamları, Google’ın gruplama ve gizlilik kuralları nedeniyle farklı olabilir.</s-banner></>:<s-section><s-paragraph>Bu seçim için site toplamı henüz getirilmedi. Google hesabınızı bağlayıp “Google raporunu getir” düğmesine basın. Eksik rapor sıfır olarak gösterilmez.</s-paragraph></s-section>}
  <s-section heading="Arama detayları"><s-select label="Rapor" value={grain} onChange={e=>{setGrain(e.currentTarget.value);setLimit(50);}}><s-option value="pages">Sayfalar</s-option><s-option value="queries">Sorgular ve sayfalar</s-option><s-option value="daily">Günler ve sayfalar</s-option></s-select>
  <s-paragraph>Google’ın döndürdüğü {rows.length} satır. Bazı sorgular gizlilik nedeniyle paylaşılmaz; API tüm satırları garanti etmez.</s-paragraph>
  {detail?.truncated&&<s-banner tone="warning">Satır sınırına ulaşıldı; bu detay raporu eksik olabilir.</s-banner>}
  {rows.length?<><s-table><s-table-header-row><s-table-header listSlot="primary">{grain==='queries'?'Sorgu / sayfa':grain==='daily'?'Gün / sayfa':'Sayfa'}</s-table-header><s-table-header>Tıklama</s-table-header><s-table-header>Gösterim</s-table-header><s-table-header>CTR</s-table-header><s-table-header>Konum</s-table-header></s-table-header-row><s-table-body>{rows.slice(0,limit).map((r,i)=><s-table-row key={`${r.page}-${r.query}-${r.date}-${i}`}><s-table-cell><div className="seo-url">{r.query||r.date||''}{(r.query||r.date)&&<br/>}{r.page}</div></s-table-cell><s-table-cell>{number(r.clicks)}</s-table-cell><s-table-cell>{number(r.impressions)}</s-table-cell><s-table-cell>%{number(r.ctr*100,2)}</s-table-cell><s-table-cell>{number(r.position,1)}</s-table-cell></s-table-row>)}</s-table-body></s-table>{rows.length>limit&&<s-button onClick={()=>setLimit(limit+50)}>Sonraki 50 satırı göster</s-button>}</>:<s-paragraph>{detail?'Google bu dönem ve filtre için satır döndürmedi.':'Bu detay raporu henüz getirilmedi.'}</s-paragraph>}
  </s-section>
 </>;
}

import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';

type Row={keyword:string;position:number|null;previous:number|null;change:number|null;volume:number|null;difficulty:number|null;url:string;serpUpdatedAt?:string|null;traffic?:number|null;trafficCost?:number|null;cpc?:number|null;intent?:string|null;status:string;serpFeatures?:string[]};
type Snapshot={observedAt:string;provider:string;count:number;distribution:number[];traffic:number|null;device:string};
export type OrganicData={report:{provider:string;observedAt:string;importedAt:string;device:string;limited:boolean;totalCount?:number|null}|null;previousDate:string|null;previousSummary:{keywords:number;traffic:number|null;trafficCost:number|null;top10:number}|null;rows:Row[];lostRows:Row[];pages:{url:string;keywords:number;position:number;traffic:number|null}[];traffic:number|null;trafficCost:number|null;history:Snapshot[]};
const format=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('tr-TR',{maximumFractionDigits:2});
const intents:Record<string,string>={informational:'Bilgi',navigational:'Gezinme',commercial:'Ticari',transactional:'İşlem'};
const states:Record<string,string>={new:'Yeni (sağlayıcı)',lost:'Kayıp (sağlayıcı)',up:'Yükseldi',down:'Geriledi',stable:'Değişmedi',unknown:'Karşılaştırma yok'};
const ranges=[['all','Tüm konumlar',1,100],['3','İlk 3',1,3],['10','4–10',4,10],['20','11–20',11,20],['50','21–50',21,50],['100','51–100',51,100]] as const;
const views=['Genel görünüm','Pozisyonlar','Pozisyon değişimleri','Sayfalar'] as const;

function Growth({value,before}:{value:number|null;before:number|null}) {
 if(value==null||before==null)return <small className="organic-growth">Karşılaştırma yok</small>;
 const difference=value-before;
 const text=before===0?(difference===0?'Değişmedi':'Önceki raporda 0'): `${difference>0?'+':''}${format(difference/before*100)}%`;
 return <small className={`organic-growth ${difference>0?'positive':difference<0?'negative':''}`}>{text} · önceki rapora göre</small>;
}

function Overview({data,onView}:{data:OrganicData;onView:(view:typeof views[number])=>void}) {
 const best=[...data.rows].sort((a,b)=>(b.traffic??-1)-(a.traffic??-1)||(a.position??101)-(b.position??101)).slice(0,5);
 const changes=[...data.rows].filter(r=>r.change!=null&&r.change!==0).sort((a,b)=>Math.abs(b.change||0)-Math.abs(a.change||0)).slice(0,5);
 const features=new Map<string,number>();for(const row of data.rows)for(const feature of new Set(row.serpFeatures||[]))if(feature!=='organic')features.set(feature,(features.get(feature)||0)+1);
 return <div className="organic-overview-grid">
  <section className="organic-overview-card"><div className="organic-card-title"><h3>En iyi anahtar kelimeler</h3><s-button variant="tertiary" onClick={()=>onView('Pozisyonlar')}>Tüm kelimeler</s-button></div><p className="suite-source">Tahmini trafiğe, veri yoksa konuma göre.</p>{best.length?<div className="suite-table-scroll"><table><thead><tr><th scope="col">Kelime</th><th scope="col">Konum</th><th scope="col">Hacim</th><th scope="col">Trafik</th></tr></thead><tbody>{best.map(r=><tr key={r.keyword}><td>{r.keyword}</td><td>{format(r.position)}</td><td>{format(r.volume)}</td><td>{format(r.traffic)}</td></tr>)}</tbody></table></div>:<p className="suite-empty">En iyi kelimeler için rapor bekleniyor.</p>}</section>
  <section className="organic-overview-card"><h3>Niyete göre kelimeler</h3><p className="suite-source">Yalnızca sağlayıcının belirttiği arama niyeti.</p>{[...Object.entries(intents),['unknown','Belirtilmemiş']].map(([key,label])=>{const n=data.rows.filter(r=>key==='unknown'?!intents[r.intent||'']:r.intent===key).length;return <div className="organic-intent" key={key}><span>{label}</span><div><i style={{width:`${data.rows.length?n/data.rows.length*100:0}%`}}/></div><b>{data.report?format(n):'—'}</b></div>;})}</section>
  <section className="organic-overview-card"><div className="organic-card-title"><h3>En büyük konum değişimleri</h3><s-button variant="tertiary" onClick={()=>onView('Pozisyon değişimleri')}>Tüm değişimler</s-button></div>{changes.length?<div className="suite-table-scroll"><table><thead><tr><th scope="col">Kelime</th><th scope="col">Önceki</th><th scope="col">Şimdi</th><th scope="col">Değişim</th></tr></thead><tbody>{changes.map(r=><tr key={r.keyword}><td>{r.keyword}</td><td>{format(r.previous)}</td><td>{format(r.position)}</td><td className={(r.change||0)>0?'positive':'negative'}>{(r.change||0)>0?'+':''}{format(r.change)}</td></tr>)}</tbody></table></div>:<p className="suite-empty">Karşılaştırılabilir konum değişimi yok.</p>}</section>
  <section className="organic-overview-card"><div className="organic-card-title"><h3>En iyi sayfalar</h3><s-button variant="tertiary" onClick={()=>onView('Sayfalar')}>Tüm sayfalar</s-button></div><p className="suite-source">Tahmini trafiğe, eksikse kelime sayısına göre.</p>{data.pages.length?<div className="suite-table-scroll"><table><thead><tr><th scope="col">URL</th><th scope="col">Kelime</th><th scope="col">Trafik</th></tr></thead><tbody>{[...data.pages].sort((a,b)=>(b.traffic??-1)-(a.traffic??-1)||b.keywords-a.keywords).slice(0,5).map(r=><tr key={r.url}><td>{r.url}</td><td>{format(r.keywords)}</td><td>{format(r.traffic)}</td></tr>)}</tbody></table></div>:<p className="suite-empty">Sıralanan sayfalar için rapor bekleniyor.</p>}</section>
  <section className="organic-overview-card"><h3>Sorgulardaki SERP özellikleri</h3><p className="suite-source">Özelliğin bulunduğu rapor kelimesi sayısı. Sitenizin o özellikte yer aldığını göstermez.</p>{features.size?<div className="organic-feature-list">{[...features].sort((a,b)=>b[1]-a[1]).map(([name,n])=><span key={name}>{name}<b>{n}</b></span>)}</div>:<p className="suite-empty">Kaynakta SERP özelliği bilgisi yok.</p>}</section>
 </div>;
}

function Trend({history}:{history:Snapshot[]}) {
 const [metric,setMetric]=useState('count'),[period,setPeriod]=useState('all');
 const last=history[history.length-1];
 const cutoff=last&&period!=='all'?Date.parse(last.observedAt)-Number(period)*86400000:-Infinity;
 const points=history.filter(r=>Date.parse(r.observedAt)>=cutoff).map(r=>({date:r.observedAt,value:metric==='count'?r.count:r.traffic}));
 const known=points.filter(p=>p.value!=null);
 const canvas=useRef<HTMLCanvasElement>(null);
 const [chartError,setChartError]=useState(false);
 useEffect(()=>{
  let disposed=false;let chart:import('chart.js').Chart|undefined;
  if(known.length<2||!canvas.current)return;
  const element=canvas.current;
  setChartError(false);
  import('chart.js/auto').then(({default:Chart})=>{
   if(disposed)return;
   const selected=history.filter(r=>Date.parse(r.observedAt)>=cutoff);
   chart=new Chart(element,{type:metric==='count'?'bar':'line',data:{labels:selected.map(r=>r.observedAt),datasets:metric==='count'?['İlk 3','4–10','11–20','21–50','51–100'].map((label,i)=>({label,data:selected.map(r=>r.distribution[i]),backgroundColor:['#ffbf42','#0085df','#25a4ff','#68c4ff','#a1dbff'][i],stack:'positions',maxBarThickness:28})):[{label:'Tahmini trafik',data:selected.map(r=>r.traffic),borderColor:'#25a4ff',backgroundColor:'#e0f3ff',fill:true}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'top',align:'start'}},scales:{x:{stacked:metric==='count',grid:{display:false}},y:{stacked:metric==='count',beginAtZero:true,ticks:{precision:0}}}}});
  }).catch(()=>{if(!disposed)setChartError(true);});
  return()=>{disposed=true;chart?.destroy();};
 },[history,metric,cutoff,known.length]);
 return <div className="organic-chart"><div className="organic-chart-controls"><strong>Organik görünürlük geçmişi</strong><s-select label="Gösterge" value={metric} onChange={e=>setMetric(e.currentTarget.value)}><s-option value="count">Kelime sayısı</s-option><s-option value="traffic">Tahmini trafik</s-option></s-select><s-select label="Grafik dönemi" value={period} onChange={e=>setPeriod(e.currentTarget.value)}><s-option value="30">1 ay</s-option><s-option value="180">6 ay</s-option><s-option value="365">1 yıl</s-option><s-option value="all">Tüm kayıtlar</s-option></s-select></div>
 {known.length<2?<p className="suite-empty">Grafik için aynı kaynaktan en az iki tarihli rapor gerekir. Geçmiş değerler üretilmez.</p>:chartError?<p className="suite-empty">Grafik yüklenemedi. Sayfayı yenileyin.</p>:<div className="organic-chart-canvas"><canvas ref={canvas} role="img" aria-label="Kayıtlı raporlara göre organik sıralama geçmişi"/></div>}
 <details><summary>Grafik verilerini göster</summary><div className="suite-table-scroll"><table><thead><tr><th>Tarih</th><th>Kelime</th><th>Tahmini trafik</th></tr></thead><tbody>{history.filter(r=>Date.parse(r.observedAt)>=cutoff).map(r=><tr key={r.observedAt}><td>{r.observedAt}</td><td>{format(r.count)}</td><td>{format(r.traffic)}</td></tr>)}</tbody></table></div></details>
 <p className="suite-source">Yalnızca bu uygulamada kaydedilmiş aynı kaynak ve kapsamdaki raporlar. Rapor kapsamı değişirse sayılar da değişebilir.</p></div>;
}

export default function OrganicRankings({data,busy,canFetch,onRefresh,onExport,children}:{data:OrganicData;busy:boolean;canFetch:boolean;onRefresh:()=>void;onExport:()=>void;children:ReactNode}) {
 const [view,setView]=useState<(typeof views)[number]>('Genel görünüm'),[query,setQuery]=useState(''),[range,setRange]=useState('all'),[sort,setSort]=useState('traffic'),[intent,setIntent]=useState('all'),[change,setChange]=useState('all'),[volume,setVolume]=useState(''),[difficulty,setDifficulty]=useState(''),[count,setCount]=useState(50);
 const selected=ranges.find(r=>r[0]===range)||ranges[0];
 const source=view==='Pozisyon değişimleri'?[...data.rows.filter(r=>['new','up','down'].includes(r.status)),...data.lostRows]:data.rows;
 const rows=source.filter(r=>`${r.keyword} ${r.url}`.toLowerCase().includes(query.trim().toLowerCase())&&(r.position==null?range==='all':r.position>=selected[2]&&r.position<=selected[3])&&(intent==='all'||r.intent===intent)&&(change==='all'||r.status===change)&&(!volume||(r.volume!=null&&r.volume>=Number(volume)))&&(!difficulty||(r.difficulty!=null&&r.difficulty<=Number(difficulty)))).sort((a,b)=>sort==='volume'?(b.volume??-1)-(a.volume??-1):sort==='traffic'?(b.traffic??-1)-(a.traffic??-1):sort==='change'?(b.change??-Infinity)-(a.change??-Infinity):(a.position??Infinity)-(b.position??Infinity));
 const reset=()=>setCount(50);
 const chooseView=(v:typeof view)=>{setView(v);setChange('all');reset();};
 const showAll=(v:typeof view)=>{setQuery('');setRange('all');setIntent('all');setVolume('');setDifficulty('');setSort('traffic');chooseView(v);};
 const cards:[string,number|null,number|null][]=[['Organik kelimeler',data.report?data.rows.length:null,data.previousSummary?.keywords??null],['Tahmini aylık trafik',data.traffic,data.previousSummary?.traffic??null],['Tahmini trafik maliyeti ($)',data.trafficCost,data.previousSummary?.trafficCost??null],['İlk 10 kelime',data.report?data.rows.filter(r=>r.position!=null&&r.position<=10).length:null,data.previousSummary?.top10??null]];
 return <>
 <s-section heading="Organik sıralamalar (Organic Rankings)">
 <div className="organic-toolbar"><div><strong>nosweatusa.com</strong><p>Google · ABD · İngilizce · Masaüstü · Organik ilk 100</p></div><s-stack direction="inline" gap="base"><s-button disabled={busy||!canFetch} variant="primary" onClick={onRefresh}>Organik kelimeleri getir</s-button><s-button disabled={busy||!data.report} onClick={onExport}>CSV dışa aktar</s-button></s-stack></div>
 {data.report&&<p className="suite-source">Kaynak: {data.report.provider} · Rapor: {data.report.observedAt} · Alınma: {data.report.importedAt}{data.report.limited?' · Sınırlı kapsam':''}{data.previousDate?` · Önceki rapor: ${data.previousDate}`:' · Karşılaştırılabilir önceki rapor yok'}</p>}
 <nav className="organic-views" aria-label="Organik sıralama görünümleri">{views.map(v=><button key={v} aria-current={view===v?'page':undefined} onClick={()=>chooseView(v)}>{v}</button>)}</nav>
 <div className="organic-summary">{cards.map(([label,value,before])=><div key={label}><span>{label}</span><strong>{format(value)}</strong><Growth value={value} before={before}/></div>)}</div>
 <p className="suite-source">Bu göstergeler rapordaki kelimelere aittir, sitenin tüm trafiğini temsil etmez. Trafik ve maliyet sağlayıcı tahminidir; Google Analytics / Search Console tıklaması değildir. Eksik tahmin varsa toplam “—” kalır.</p>
 
 {view==='Genel görünüm'&&<><Trend history={data.history}/><div className="organic-distribution"><strong>Konum dağılımı</strong>{ranges.slice(1).map(r=><button key={r[0]} onClick={()=>{showAll('Pozisyonlar');setRange(r[0]);}}>{r[1]}<b>{data.report?format(data.rows.filter(k=>k.position!=null&&k.position>=r[2]&&k.position<=r[3]).length):'—'}</b></button>)}</div><Overview data={data} onView={showAll}/></>}
 {view!=='Sayfalar'&&view!=='Genel görünüm'&&<>
 <div className="organic-filters"><s-search-field label="Kelime veya URL ara" value={query} onInput={e=>{setQuery(e.currentTarget.value);reset();}}/><s-select label="Konum" value={range} onChange={e=>{setRange(e.currentTarget.value);reset();}}>{ranges.map(r=><s-option key={r[0]} value={r[0]}>{r[1]}</s-option>)}</s-select><s-select label="Niyet" value={intent} onChange={e=>{setIntent(e.currentTarget.value);reset();}}><s-option value="all">Tüm niyetler</s-option>{Object.entries(intents).map(([v,label])=><s-option key={v} value={v}>{label}</s-option>)}</s-select><s-select label="Sırala" value={sort} onChange={e=>{setSort(e.currentTarget.value);reset();}}><s-option value="traffic">Trafik</s-option><s-option value="position">Konum</s-option><s-option value="volume">Hacim</s-option><s-option value="change">Yükseliş</s-option></s-select><s-number-field label="En az hacim" min={0} value={volume} onInput={e=>{setVolume(e.currentTarget.value);reset();}}/><s-number-field label="En fazla zorluk" min={0} max={100} value={difficulty} onInput={e=>{setDifficulty(e.currentTarget.value);reset();}}/></div>
 {view==='Pozisyon değişimleri'&&<><s-select label="Değişim türü" value={change} onChange={e=>{setChange(e.currentTarget.value);reset();}}><s-option value="all">Tüm değişimler</s-option>{['new','up','down','lost'].map(v=><s-option key={v} value={v}>{states[v]}</s-option>)}</s-select><p className="suite-source">Yeni/kayıp yalnızca sağlayıcının açık işaretine dayanır. Yükseliş/gerileme aynı kaynak ve kapsamın önceki kayıtlı raporuyla hesaplanır. Sınırlı rapordan kaybolmak, sıralamanın kaybolduğu anlamına gelmez.</p></>}
 {!data.report?<p className="suite-empty">Henüz organik sıralama verisi yok. Takip kelimesi seçmeden DataForSEO’dan getirin veya gerçek sağlayıcı CSV raporu yükleyin.</p>:<><p>{rows.length} eşleşen kelime · {data.rows.length} mevcut organik kelime</p><div className="suite-table-scroll"><table><thead><tr>{['Anahtar kelime','Niyet','Konum','Önceki','Değişim','Durum','Trafik (tahmin)','Aylık hacim','KD / 100','CPC ($)','URL','Sorgudaki SERP özellikleri','SERP veri tarihi'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.slice(0,count).map(r=><tr key={r.keyword}><td>{r.keyword}</td><td>{intents[r.intent||'']||'—'}</td><td>{format(r.position)}</td><td>{format(r.previous)}</td><td>{r.change==null?'—':r.change>0?`+${r.change}`:format(r.change)}</td><td>{states[r.status]||'—'}</td><td>{format(r.traffic)}</td><td>{format(r.volume)}</td><td>{format(r.difficulty)}</td><td>{format(r.cpc)}</td><td>{r.url}</td><td>{r.serpFeatures?.filter(f=>f!=='organic').join(', ')||'—'}</td><td>{r.serpUpdatedAt||'Belirtilmedi'}</td></tr>)}</tbody></table></div>{!rows.length&&<p>Bu filtrelerde sonuç bulunamadı.</p>}{rows.length>count&&<s-button onClick={()=>setCount(count+50)}>Sonraki 50 satır</s-button>}</>}
 </>}
 {view==='Sayfalar'&&<><s-search-field label="Sıralanan URL ara" value={query} onInput={e=>{setQuery(e.currentTarget.value);reset();}}/><p>URL başına rapordaki organik kelimeler. Trafik, bu kelimelerin sağlayıcı tahminlerinin toplamıdır.</p><div className="suite-table-scroll"><table><thead><tr>{['URL','Kelime','En iyi konum','Tahmini trafik','İşlem'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{data.pages.filter(p=>p.url.toLowerCase().includes(query.toLowerCase())).slice(0,count).map(p=><tr key={p.url}><td>{p.url}</td><td>{format(p.keywords)}</td><td>{format(p.position)}</td><td>{format(p.traffic)}</td><td><s-button onClick={()=>{setQuery(p.url);setRange('all');setIntent('all');setVolume('');setDifficulty('');chooseView('Pozisyonlar');}}>Kelimeleri göster</s-button></td></tr>)}</tbody></table></div>{!data.pages.length&&<p className="suite-empty">Sayfa raporu için organik sıralama verisi gerekir.</p>}{data.pages.length>count&&<s-button onClick={()=>setCount(count+50)}>Sonraki 50 sayfa</s-button>}</>}
 <p className="suite-source">DataForSEO Labs haftalık güncellenir; anlık SERP ölçümü değildir. Sorgu başına en fazla 1.000 satır, CSV ile en fazla 2.000 satır. Niyet, CPC ve SERP özellikleri yalnızca kaynakta varsa gösterilir. SERP özellikleri sitenizin bu özelliklerde yer aldığını kanıtlamaz.</p>
 {children}
 </s-section>
 </>;
}

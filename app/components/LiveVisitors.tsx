import {useEffect,useState} from 'react';
import {useFetcher} from 'react-router';
import {VISITOR_PERIODS,VISITOR_DEVICES,countryFlag} from '../lib/visitors.mjs';
import type {ActionInput} from '../lib/types';

export type Visit={id:string;country:string;source:string;medium:string;campaign:string;label:string;device:string;firstAt:string;lastAt:string;views:number;pages:{path:string;at:string;product:boolean;title:string}[]};
export type VisitorData={error?:string;config:{configured:boolean;enabled:boolean;createdAt:string|null};report:{period:string;start:string;end:string;timeZone:string;generatedAt:string;limited:boolean;active:number;visits:number;views:number;productViews:number;daily:{date:string;visits:number;views:number}[];countries:{code:string;visits:number}[];sources:{source:string;medium:string;campaign:string;label:string;visits:number}[];products:{path:string;title:string;image:string;views:number}[];recent:Visit[]}};
const names=new Intl.DisplayNames(['tr'],{type:'region'});
function countryName(code:string){try{return code==='ZZ'?'Bilinmeyen ülke':names.of(code)||code;}catch{return 'Bilinmeyen ülke';}}
function Flag({code}:{code:string}){return <span className="traffic-country">{/^[A-Z]{2}$/.test(code)&&code!=='ZZ'?<img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} width={24} height={16} alt={countryFlag(code)} loading="lazy" referrerPolicy="no-referrer"/>:'🌐'}{countryName(code)}</span>;}
type PanelProps={data?:VisitorData;period:string;onPeriod:(value:string)=>void;refresh:()=>void;loading:boolean;busy:boolean;onAction:(input:ActionInput)=>void};
export function LiveVisitorPanel({data,period,onPeriod,refresh,loading,busy,onAction}:PanelProps){
 const [country,setCountry]=useState(''),[source,setSource]=useState('');
 const report=data?.report,config=data?.config;
 const recent=report?.recent.filter(v=>(!country||v.country===country)&&(!source||v.source===source))||[];
 const at=(value:string)=>new Date(value).toLocaleString('tr-TR',{timeZone:report?.timeZone,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
 return <div className="traffic-panel live-visitors">
  <section className="analytics-card traffic-intro"><div><h2>Canlı ziyaretler</h2><p>Ülke, giriş kaynağı ve gezilen sayfalar. Shopify mağazanızdan doğrudan ölçülür.</p></div><span className="traffic-chip">{config?.enabled?'● Takip açık':'Takip kurulumu'}</span></section>
  {data?.error&&<s-banner tone="warning">{data.error}</s-banner>}
  <details className="studio-details" open={Boolean(config&&!config.configured)}><summary>Ziyaret takibi kurulumu</summary><div className="traffic-settings">
   <p>Bir kez Shopify → Ayarlar → Müşteri etkinlikleri → Özel piksel bölümüne kurulur. Adı: <strong>No Sweat Visitors</strong>. İzin: <strong>Analytics gerekli</strong>; veri satışı: <strong>uygulanamaz</strong>.</p>
   <div className="traffic-actions"><s-button disabled={busy} onClick={()=>onAction({intent:config?.enabled?'visitors-pause':'visitors-enable'})}>{config?.enabled?'Takibi duraklat':'Ziyaret takibini hazırla / aç'}</s-button>{config?.configured&&<s-button disabled={busy} onClick={()=>onAction({intent:'visitors-code'})}>Piksel kodunu indir</s-button>}</div>
   <p>Kodu kaydedip Shopify’da pikseli bağlayın. Aşağıda ilk ziyaret göründüğünde veri alındığı doğrulanır. Önceden gerçekleşen ziyaretler bu listeye eklenmez.</p>
  </div></details>
  <section className="analytics-card"><div className="traffic-toolbar"><label>Canlı ziyaret dönemi<select value={period} onChange={e=>{onPeriod(e.target.value);setCountry('');setSource('');}}>{Object.entries(VISITOR_PERIODS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><s-button disabled={loading} onClick={refresh}>{loading?'Yenileniyor…':'Ziyaretleri yenile'}</s-button></div><p>Bu ekran açıkken 15 saniyede bir yenilenir. “Son 5 dakika” bir sayfayı açan ziyaretleri sayar; sayfada hâlâ bulunma garantisi değildir.</p>{report&&<small>{report.start} — {report.end} · {report.timeZone} · Son veri: {at(report.generatedAt)}</small>}</section>
  {!report?<section className="analytics-card"><p>{loading?'Ziyaretler yükleniyor…':'Ziyaret verilerini almak için yenileyin.'}</p></section>:<>
   {report.limited&&<s-banner tone="warning">Yoğun trafik nedeniyle en son 30.000 olay gösteriliyor; bu dönemin sayıları eksik olabilir.</s-banner>}
   <div className="traffic-metrics live-metrics">{[{label:'Son 5 dakikada ziyaret',value:report.active},{label:'Dönemde ziyaret',value:report.visits},{label:'Sayfa görüntüleme',value:report.views},{label:'Ürün görüntüleme',value:report.productViews}].map(m=><section className="analytics-card" key={m.label}><span>{m.label}</span><strong>{m.value.toLocaleString('tr-TR')}</strong></section>)}</div>
   {!report.visits&&<section className="analytics-card"><h3>Henüz ölçülmüş ziyaret yok</h3><p>{config?.configured?'Pikselin Shopify’da bağlı olduğunu kontrol edin. Analitik izni olan ziyaretler geldikçe burada görünecek.':'Ziyaret takibini hazırlayıp pikseli bağladıktan sonra bu bölüm dolmaya başlayacak.'}</p></section>}
   <div className="live-columns"><section className="analytics-card"><h3>Ülkeler ve bayraklar</h3><div className="traffic-countries">{report.countries.map(c=><button key={c.code} aria-pressed={country===c.code} onClick={()=>setCountry(country===c.code?'':c.code)}><Flag code={c.code}/><strong>{c.visits} ziyaret</strong></button>)}</div>{!report.countries.length&&<p>Ülke verisi bekleniyor.</p>}</section><section className="analytics-card"><h3>Giriş kaynakları</h3><div className="live-sources">{report.sources.map((s,i)=><button key={i} aria-pressed={source===s.source} onClick={()=>setSource(source===s.source?'':s.source)}><span><strong>{s.label}</strong><small>{s.medium}{s.campaign?` · ${s.campaign}`:''}</small></span><b>{s.visits}</b></button>)}</div>{!report.sources.length&&<p>Kaynak verisi bekleniyor.</p>}</section></div>
   <section className="analytics-card"><div className="traffic-intro"><div><h3>Ziyaretçi akışı</h3><p>Son 100 ziyaret. Bir ziyareti açarak baktığı sayfaları görebilirsiniz.</p></div>{(country||source)&&<s-button onClick={()=>{setCountry('');setSource('');}}>Filtreleri temizle</s-button>}</div>
    <div className="live-feed">{recent.map(v=><details key={v.id}><summary><span className="live-visitor"><strong>Ziyaret #{v.id.slice(0,6)}</strong><small>{at(v.lastAt)} · {VISITOR_DEVICES[v.device as keyof typeof VISITOR_DEVICES]||'Bilinmeyen cihaz'}</small></span><Flag code={v.country}/><span><strong>{v.label}</strong><small>{v.campaign||v.medium}</small></span><span>{v.views} sayfa <span aria-hidden>⌄</span></span></summary><div className="live-paths">{v.pages.map((p,i)=><div key={i}><time>{at(p.at)}</time><span><strong>{p.product?'Ürün: ':''}{p.product?p.title:p.path}</strong>{p.product&&<small>{p.path}</small>}</span></div>)}</div></details>)}</div>{!recent.length&&<p>Bu filtrede ziyaret bulunamadı.</p>}
   </section>
   <section className="analytics-card"><h3>Günlük ziyaretler</h3><div className="traffic-chart">{report.daily.map(d=><div key={d.date}><time>{d.date.slice(5)}</time><div><span style={{width:`${d.visits/Math.max(1,...report.daily.map(r=>r.visits))*100}%`}}/></div><strong>{d.visits}</strong></div>)}</div></section>
   <section className="analytics-card"><h3>Görüntülenen ürünler</h3><div className="traffic-table"><table><thead><tr><th>Ürün</th><th>Görüntüleme</th></tr></thead><tbody>{report.products.slice(0,100).map(p=><tr key={p.path}><td><strong>{p.title}</strong><small>{p.path}</small></td><td>{p.views}</td></tr>)}</tbody></table></div>{!report.products.length&&<p>Henüz ürün görüntüleme olayı yok.</p>}</section>
  </>}
  <p className="traffic-note">Ziyaretler 30 dakikalık hareketsizlikten sonra, sekme kapanınca veya UTC gün değişince ayrılır; kişi sayısı değildir. Filtreler yalnızca ziyaretçi akışına uygulanır. Ülke yaklaşık IP konumudur; VPN etkileyebilir. Direct, referrer bilgisi olmayan ziyaretleri de içerir. Instagram/TikTok reklam ayrımı için UTM önerilir. Analitik izni ve tarayıcı engelleri ölçümü etkiler. Kayıtlar 30 gün tutulur; isim, e-posta ve ham IP bu kayıtlara yazılmaz.</p>
 </div>;
}
export default function LiveVisitors({busy,onAction}:{busy:boolean;onAction:(input:ActionInput)=>void}){
 const [period,setPeriod]=useState('today');const fetcher=useFetcher<VisitorData>();
 const load=()=>fetcher.load(`/app/visitors?period=${period}`);
 useEffect(()=>{load();},[period,busy]); // Refresh settings after parent actions finish.
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible'&&fetcher.state==='idle')load();},15000);return()=>clearInterval(timer);},[period,fetcher.state]);
 return <LiveVisitorPanel data={fetcher.data} period={period} onPeriod={setPeriod} refresh={load} loading={fetcher.state!=='idle'} busy={busy} onAction={onAction}/>;
}

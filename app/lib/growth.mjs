import {plain,audit} from './core/seo.mjs';
export const manualChecks=[
 {key:'shipping',label:"ABD’ye kargo ücreti ve teslimat süresi açıkça belirtiliyor"},
 {key:'returns',label:"İade koşulları alıcı tarafından görülebiliyor"},
 {key:'facts',label:"Ürün özellikleri ve iddiaları kontrol edildi"},
 {key:'reviews',label:"Mevcut yorumlar gerçek; sahte yorum veya puan yok"},
 {key:'mobile',label:"Mobil cihazda ürün seçimi ve satın alma akışı kontrol edildi"},
];
export function pageKey(value){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||!['nosweatusa.com','www.nosweatusa.com'].includes(u.hostname))return null;return u.pathname.replace(/\/+$/,'')||'/';}catch{return null;}}
const day=s=>new Date(`${s}T00:00:00Z`);
const plus=(s,n)=>{const d=day(s);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const days=(a,b)=>Math.round((day(b)-day(a))/86400000)+1;
export function pacificDate(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function weekStart(now){const d=day(pacificDate(now)),weekday=d.getUTCDay();d.setUTCDate(d.getUTCDate()-((weekday+6)%7));return d.toISOString().slice(0,10);}
export function metrics(rows){const clicks=rows.reduce((n,r)=>n+r.clicks,0),impressions=rows.reduce((n,r)=>n+r.impressions,0);return {clicks,impressions,ctr:impressions?clicks/impressions:0,position:impressions?rows.reduce((n,r)=>n+r.position*r.impressions,0)/impressions:null};}
const isUSA=r=>r.source==='google-api'&&r.country==='usa'&&r.searchType==='web'&&r.device==='all';
const sameScope=(a,b)=>a.property===b.property&&a.grain===b.grain&&a.country===b.country&&a.device===b.device&&a.searchType===b.searchType&&a.source===b.source;
function reportPair(reports,grain){const sorted=reports.filter(r=>r.grain===grain&&isUSA(r)).sort((a,b)=>b.endDate.localeCompare(a.endDate)||b.importedAt.localeCompare(a.importedAt));const current=sorted[0]||null;const previous=current&&sorted.find(r=>sameScope(current,r)&&plus(r.endDate,1)===current.startDate&&days(r.startDate,r.endDate)===days(current.startDate,current.endDate));return {current,previous:previous||null};}
function reportSummary(r){return r?{startDate:r.startDate,endDate:r.endDate,property:r.property,truncated:r.truncated,totals:metrics(r.rows)}:null;}
function pageRows(report,key){return report?.rows.filter(r=>pageKey(r.page)===key)||[];}
export function readiness(page,state){const saved=state.growth?.checks?.[page.id]||{};return [
 {key:'photos',label:"Katalogda ürün görseli var",status:page.images?.length?'yes':'no',automatic:true,updatedAt:null},
 {key:'description',label:"Katalogda ürün açıklaması var",status:plain(page.descriptionHtml)?'yes':'no',automatic:true,updatedAt:null},
 ...manualChecks.map(c=>({...c,status:saved[c.key]?.status||'unknown',automatic:false,updatedAt:saved[c.key]?.updatedAt||null})),
 ];}
export function setReadiness(state,{pageId,check,status}){if(!state.catalog.pages.some(p=>p.id===pageId&&p.type==='product')||!manualChecks.some(c=>c.key===check)||!['yes','no','unknown'].includes(status))throw new Error("Ürün kontrolü geçerli değil.");state.growth||={};state.growth.checks||={};state.growth.checks[pageId]||={};state.growth.checks[pageId][check]={status,updatedAt:new Date().toISOString()};}
export function outreachTemplate(backlink,target){return {subject:'No Sweat USA — useful product reference',body:backlink.status==='mention'?`Hello,\n\nYour page (${backlink.url}) mentions No Sweat USA. If it would help your readers, would you consider linking that mention to ${target}?\n\nPlease only add the link if it is relevant to your editorial content. Thank you for considering it.\n\nNo Sweat USA`:`Hello,\n\nI would like to suggest a No Sweat USA resource for your consideration: ${target}\n\nIf it is relevant to the readers of your page (${backlink.url}), would you consider including it as a reference? Please review the product information and decide independently whether it is useful.\n\nThank you,\nNo Sweat USA`};}
export function saveOutreach(state,input){const source=(state.backlinks||[]).find(b=>b.id===input.backlinkId);const page=state.catalog.pages.find(p=>p.id===input.pageId&&p.url&&pageKey(p.url));if(!source||!page)throw new Error("Kaynak ve ürün sayfasını seçin.");const fresh=outreachTemplate(source,page.url);const subject=input.subject??fresh.subject,body=input.body??fresh.body;if(typeof subject!=='string'||typeof body!=='string'||!subject.trim()||!body.trim()||subject.length>200||body.length>5000)throw new Error("Konu 1–200, metin 1–5000 karakter olmalıdır.");state.growth||={};state.growth.outreach||={};state.growth.outreach[source.id]={backlinkId:source.id,pageId:page.id,target:page.url,subject:subject.trim(),body:body.trim(),updatedAt:new Date().toISOString()};}
export function changeEffects(state,changes){
 const reports=(state.growth?.reports||[]).filter(r=>isUSA(r)&&r.grain==='page-date');const latest=[...reports].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0];
 const usable=latest?reports.filter(r=>sameScope(latest,r)):[];const rows=new Map(),coverage=new Set();let truncated=false;
 for(const r of [...usable].sort((a,b)=>a.importedAt.localeCompare(b.importedAt))){if(r.truncated)truncated=true;for(let d=r.startDate;d<=r.endDate;d=plus(d,1))coverage.add(d);for(const row of r.rows){const key=pageKey(row.page);if(key&&row.date)rows.set(`${row.page}:${row.date}`,row);}}
 return changes.filter(c=>c.status==='applied'&&state.catalog.pages.some(p=>p.id===c.pageId)).slice(0,20).map(c=>{
  const page=state.catalog.pages.find(p=>p.id===c.pageId),key=pageKey(page.url),changed=pacificDate(c.createdAt);const beforeStart=plus(changed,-7),beforeEnd=plus(changed,-1),afterStart=plus(changed,1),afterEnd=plus(changed,7);
  const base={id:c.id,pageId:c.pageId,pageTitle:c.pageTitle,changed,beforeStart,beforeEnd,afterStart,afterEnd,before:null,after:null,clickDifference:null,status:'waiting',reason:''};
  if(!key||!latest)return {...base,reason:"ABD için günlük Google raporunu getirin."};
  if(truncated)return {...base,status:'limited',reason:"Günlük raporun satır sınırına ulaşıldı; güvenilir karşılaştırma gösterilemiyor."};
  for(let d=beforeStart;d<=afterEnd;d=plus(d,1))if(d!==changed&&!coverage.has(d))return {...base,reason:"Değişiklikten önceki ve sonraki 7 tam günün verileri gereklidir."};
  if(changes.some(other=>other.id!==c.id&&other.pageId===c.pageId&&other.status==='applied'&&pacificDate(other.createdAt)>=beforeStart&&pacificDate(other.createdAt)<=afterEnd))return {...base,status:'overlap',reason:"Bu zaman aralığında sayfada başka bir düzenleme de yapıldı; etkiler birbirinden ayrılamıyor."};
  const all=[...rows.values()].filter(r=>pageKey(r.page)===key);const beforeRows=all.filter(r=>r.date>=beforeStart&&r.date<=beforeEnd),afterRows=all.filter(r=>r.date>=afterStart&&r.date<=afterEnd);
  if(!beforeRows.length||!afterRows.length)return {...base,status:'limited',reason:"Dönemlerden birinde sayfa satırı yok. Eksik veriler sıfır tıklama sayılmaz."};
  const before=metrics(beforeRows),after=metrics(afterRows);return {...base,status:'available',reason:"Google’ın döndürdüğü satırlara dayalı gözlemdir. Değişiklik günü hariç tutulur; neden-sonuç kanıtı değildir.",before,after,clickDifference:after.clicks-before.clicks};
 });
}
export function growthData(state,changes=[],now=new Date()){
 const {current,previous}=reportPair(state.gsc||[],'page');const queryPair=reportPair(state.growth?.reports||[],'page-query');const queryReport=current&&queryPair.current&&sameScope({...current,grain:'page-query'},queryPair.current)&&current.startDate===queryPair.current.startDate&&current.endDate===queryPair.current.endDate?queryPair.current:null;
 const pages=state.catalog.pages,byPath=new Map(pages.filter(p=>p.url&&pageKey(p.url)).map(p=>[pageKey(p.url),p]));const opportunities=[],queries=[];
 for(const [path,page] of byPath){const present=pageRows(current,path),prior=pageRows(previous,path);if(!present.length)continue;const m=metrics(present),before=prior.length?metrics(prior):null;const eligible=page.type!=='product'||!page.status||page.status==='ACTIVE';
  if(eligible&&m.impressions>=100&&m.position>=3&&m.position<=20&&m.ctr<.03)opportunities.push({pageId:page.id,pageTitle:page.title,url:page.url,...m,previous:before,reason:"100+ gösterim, 3–20 ortalama konum, %3’ün altında CTR. Bunlar seçim filtreleridir.",action:"Başlık ve meta açıklamayı alıcının aramasına uygun hale getirin; öneriyi onaylamadan önce kontrol edin."});
 }
 const queryGroups=new Map();
 for(const row of queryReport?.rows||[]){const page=byPath.get(pageKey(row.page));if(page&&row.query){const key=JSON.stringify([page.id,row.query]);if(!queryGroups.has(key))queryGroups.set(key,{page,rows:[]});queryGroups.get(key).rows.push(row);}}
 for(const {page,rows} of queryGroups.values())queries.push({...rows[0],...metrics(rows),pageId:page.id,pageTitle:page.title,mapped:state.mappings?.[page.id]===rows[0].query});
 const queryCounts=new Map();for(const q of queries){const key=q.query.toLowerCase();if(!queryCounts.has(key))queryCounts.set(key,new Set());queryCounts.get(key).add(q.pageId);}for(const q of queries)q.pageCount=queryCounts.get(q.query.toLowerCase()).size;
 opportunities.sort((a,b)=>b.impressions-a.impressions||a.pageId.localeCompare(b.pageId));queries.sort((a,b)=>b.impressions-a.impressions||a.query.localeCompare(b.query));
 const products=pages.filter(p=>p.type==='product').map(p=>({pageId:p.id,pageTitle:p.title,url:p.url,checks:readiness(p,state)}));const tasks=[];
 const task=(id,title,detail,pageId,section,priority)=>tasks.push({id,title,detail,pageId,section,priority});
 for(const r of state.technical?.pages||[])if(r.technical?.noindex||[404,410].includes(r.status))task(`technical:${r.pageId}`,"Yayınlanmış sayfayı kontrol et",`${r.title}: ${r.technical?.noindex?"noindex yönergesi var":`HTTP ${r.status}`}. Bunun amaçlı olup olmadığını kontrol edin.`,r.pageId,"Teknik SEO",100);
 for(const o of opportunities)task(`ctr:${o.pageId}`,"Gösterimleri tıklamaya dönüştürmek için metni kontrol et",`${o.pageTitle}: ${o.impressions} gösterim, ${o.clicks} tıklama, ${(o.ctr*100).toFixed(1)}% CTR.`,o.pageId,'editor',80+Math.min(9,Math.log10(o.impressions)));
 if(current&&previous&&!current.truncated&&!previous.truncated)for(const [path,p] of byPath){const a=pageRows(current,path),b=pageRows(previous,path);if(a.length&&b.length){const before=metrics(b),after=metrics(a);if(before.clicks>=20&&after.clicks<=before.clicks*.7)task(`decline:${p.id}`,"Tıklama düşüşünü araştır",`${p.title}: ${before.clicks} → ${after.clicks} ABD tıklaması. Nedeni henüz belirlenmedi.`,p.id,"Google sonuçları",90);}}
 for(const p of audit(pages,state.mappings))if((p.type!=='product'||!p.status||p.status==='ACTIVE')&&p.issues.some(i=>['title_missing','title_duplicate','meta_missing','body_missing'].includes(i.code)))task(`seo:${p.id}`,"Ürünün SEO metnini tamamla",`${p.title}: ${p.issues.filter(i=>['title_missing','title_duplicate','meta_missing','body_missing'].includes(i.code)).map(i=>i.label).join(', ')}.`,p.id,'editor',65);
 for(const p of products)if(p.checks.some(c=>!c.automatic&&c.status!=='yes'))task(`readiness:${p.pageId}`,"Satın alma için önemli bilgileri kontrol et",`${p.pageTitle}: kargo, iade ve mobil satın alma kontrolü.`,p.pageId,'checklist',40);
 for(const b of state.backlinks||[])if(b.status==='mention')task(`outreach:${b.id}`,"Bağlantısız marka anılması için metin hazırla",b.url,null,'outreach',50);
 if(!current)task('setup:google',"ABD için Google verilerini getir","Google hesabını bağlayıp raporu güncelleyin; sıralama ve tıklamalar tahmin edilmez.",null,"Google sonuçları",95);
 if(!pages.length)task('setup:catalog',"Ürün kataloğunu getir","Ürün düzeyindeki görevler için kataloğu güncelleyin.",null,'sync',99);
 const week=weekStart(now);tasks.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));const completed=tasks.filter(t=>state.growth?.done?.[t.id]?.week===week);const selected=[],seen=new Set();for(const t of tasks){if(completed.some(c=>c.id===t.id)||t.pageId&&seen.has(t.pageId))continue;selected.push(t);if(t.pageId)seen.add(t.pageId);if(selected.length===3)break;}
 return {week,current:reportSummary(current),previous:reportSummary(previous),syncedAt:state.growth?.syncedAt||null,opportunities:opportunities.slice(0,50),queries:queries.slice(0,100),queryCount:queries.length,queryLimited:Boolean(queryReport?.truncated),products,tasks:selected,completed,effects:changeEffects(state,changes),outreach:Object.values(state.growth?.outreach||{}).filter(d=>(state.backlinks||[]).some(b=>b.id===d.backlinkId)),warnings:[...(current?.truncated?["Sayfa raporu, satır sınırı nedeniyle kısıtlandı."]:[]),...(queryReport?.truncated?["Anahtar kelime raporu, satır sınırı nedeniyle kısıtlandı."]:[]),...(current&&new Date(now).getTime()-Date.parse(current.importedAt)>3*86400000?["Google verileri 3 günden eski; güncelleyin."]:[])],allTaskIds:tasks.map(t=>t.id)};
}
export function setTaskDone(state,input){const data=growthData(state);if(!data.allTaskIds.includes(input.taskId))throw new Error("Görev artık güncel değil; paneli yenileyin.");state.growth||={};state.growth.done||={};if(input.done==='true')state.growth.done[input.taskId]={week:data.week,at:new Date().toISOString()};else delete state.growth.done[input.taskId];}

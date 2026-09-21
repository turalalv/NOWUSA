import process from 'node:process';
import {Buffer} from 'node:buffer';
import {OWN_DOMAIN,domain} from './seo-suite.mjs';
export const providerConfigured=()=>Boolean(process.env.DATAFORSEO_LOGIN&&process.env.DATAFORSEO_PASSWORD);
export async function providerRequest(endpoint,payload,fetcher=fetch,deadline=Date.now()+45000){
 if(!providerConfigured())throw new Error('DataForSEO bağlantısı hazır değil. Sunucuda API hesabını bağlayın veya CSV yükleyin.');
 const allowed=['serp/google/organic/live/advanced','dataforseo_labs/google/ranked_keywords/live','dataforseo_labs/google/keyword_overview/live','backlinks/backlinks/live'];if(!allowed.includes(endpoint))throw new Error('Desteklenmeyen veri isteği.');
 const r=await fetcher(`https://api.dataforseo.com/v3/${endpoint}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(45000,deadline-Date.now()))),headers:{'content-type':'application/json',authorization:`Basic ${Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')}`},body:JSON.stringify([payload])});
 if(!r.ok)throw new Error(`SEO veri hizmeti HTTP ${r.status} döndürdü.`);const text=await r.text();if(text.length>8_000_000)throw new Error('Veri yanıtı boyut sınırını aştı.');let data;try{data=JSON.parse(text);}catch{throw new Error('SEO hizmeti geçerli veri döndürmedi.');}
 const task=data.tasks?.[0];if(data.status_code!==20000||task?.status_code!==20000||!Array.isArray(task.result)||!task.result[0])throw new Error('SEO veri hizmeti isteği tamamlamadı. Bakiye ve API ürün erişimini kontrol edin.');return task.result[0];
}
const metrics=r=>({keyword:r.keyword,volume:r.keyword_info?.search_volume??null,difficulty:r.keyword_properties?.keyword_difficulty??null,updatedAt:r.keyword_info?.last_updated_time||null});
const safeURL=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const ownURL=value=>{try{return domain(new URL(value).hostname)===OWN_DOMAIN;}catch{return false;}};
export async function fetchSuiteProvider(s,kind,request=providerRequest,deadline=Date.now()+120000){
 const call=(endpoint,payload)=>{if(Date.now()>=deadline)throw new Error('SEO veri isteği süre sınırına ulaştı.');return request(endpoint,payload,undefined,deadline);};
 const meta={provider:'DataForSEO',observedAt:new Date().toISOString().slice(0,10),importedAt:new Date().toISOString(),country:'us',language:'en'};
 const locale={location_code:2840,language_code:'en'};
 if(kind==='ranks'){
  if(!s.settings.keywords.length)throw new Error('Önce takip edilecek ifadeleri kaydedin.');const rows=[];
  for(const keyword of s.settings.keywords){for(const device of ['desktop','mobile']){
   const result=await call('serp/google/organic/live/advanced',{...locale,keyword,device,depth:100});
   if(!Array.isArray(result.items))throw new Error('Sıralama yanıtı eksik; önceki rapor korundu.');
   const item=result.items.filter(i=>i.type==='organic'&&ownURL(i.url)).sort((a,b)=>a.rank_group-b.rank_group)[0];
   if(item&&(!Number.isInteger(item.rank_group)||item.rank_group<1))throw new Error('Sıralama değeri geçersiz.');
   rows.push({keyword,device,position:item?.rank_group??null,url:safeURL(item?.url),depth:100});
  }}return {...meta,rows,limited:true};
 }
 if(kind==='keywords'){
  if(!s.settings.keywords.length)throw new Error('Önce araştırılacak ifadeleri kaydedin.');const result=await call('dataforseo_labs/google/keyword_overview/live',{...locale,keywords:s.settings.keywords});return {...meta,rows:(result.items||[]).map(metrics),limited:false};
 }
 if(kind==='organic'){
  const r=await call('dataforseo_labs/google/ranked_keywords/live',{...locale,target:OWN_DOMAIN,limit:1000,filters:[['ranked_serp_element.serp_item.type','=','organic'],'and',['ranked_serp_element.serp_item.rank_group','<=',100]],order_by:['ranked_serp_element.serp_item.rank_group,asc']});
  if(!Array.isArray(r.items)&&r.total_count!==0)throw new Error('Organik sıralama yanıtı eksik; önceki rapor korundu.');
  const rows=(r.items||[]).filter(i=>i.ranked_serp_element?.serp_item?.type==='organic'&&!i.ranked_serp_element.is_lost&&ownURL(i.ranked_serp_element.serp_item.url)).map(i=>({...metrics(i.keyword_data),position:i.ranked_serp_element.serp_item.rank_group,traffic:i.ranked_serp_element.serp_item.etv??null,trafficCost:i.ranked_serp_element.serp_item.estimated_paid_traffic_cost??null,cpc:i.keyword_data.keyword_info?.cpc??null,intent:i.keyword_data.search_intent_info?.main_intent??null,isNew:i.ranked_serp_element.serp_item.rank_changes?.is_new===true,serpFeatures:i.ranked_serp_element.serp_item_types||[],url:safeURL(i.ranked_serp_element.serp_item.url),serpUpdatedAt:i.ranked_serp_element.last_updated_time||null}));
  if(rows.some(i=>!i.keyword||!Number.isInteger(i.position)||i.position<1||i.position>100))throw new Error('Organik sıralama değeri geçersiz; önceki rapor korundu.');
  const unique=[...new Map(rows.sort((a,b)=>b.position-a.position).map(r=>[r.keyword,r])).values()];
  const lostRows=(r.items||[]).filter(i=>i.ranked_serp_element?.is_lost===true&&ownURL(i.ranked_serp_element.serp_item?.url)).map(i=>({...metrics(i.keyword_data),url:safeURL(i.ranked_serp_element.serp_item.url),position:null,status:'lost'}));
  return {...meta,lostRows,domain:OWN_DOMAIN,device:'desktop',totalCount:r.total_count??null,limited:r.total_count==null||r.total_count>unique.length,rows:unique};
 }
 if(kind==='gaps'){
  if(!s.settings.competitors.length)throw new Error('Önce rakip alan adlarını kaydedin.');const reports={};
  for(const target of [OWN_DOMAIN,...s.settings.competitors]){const r=await call('dataforseo_labs/google/ranked_keywords/live',{...locale,target,limit:1000,filters:['ranked_serp_element.serp_item.type','=','organic']});reports[target]={...meta,domain:target,device:'desktop',limited:(r.total_count||0)>(r.items?.length||0),rows:(r.items||[]).map(i=>({...metrics(i.keyword_data),position:i.ranked_serp_element?.serp_item?.rank_group??null,url:safeURL(i.ranked_serp_element?.serp_item?.url)})).filter(r=>r.keyword&&r.position>0)};}return reports;
 }
 if(kind==='backlinks'){
  const r=await call('backlinks/backlinks/live',{target:OWN_DOMAIN,mode:'as_is',limit:1000,order_by:['last_seen,desc']});
  return {...meta,limited:(r.total_count||0)>(r.items?.length||0),rows:(r.items||[]).filter(i=>ownURL(i.url_to)&&safeURL(i.url_from)).map(i=>({source:safeURL(i.url_from),target:safeURL(i.url_to),anchor:i.anchor||'',status:i.is_lost?'lost':i.is_new?'new':'active',firstSeen:i.first_seen,lastSeen:i.last_seen}))};
 }
 throw new Error('Rapor türü desteklenmiyor.');
}

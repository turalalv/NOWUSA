import {sourceLabel,productInfo} from './traffic.mjs';
export {countryFlag} from './traffic.mjs';

export const VISITOR_PERIODS={today:'Bugün',yesterday:'Dün',week:'Son 7 gün (bugün dahil)'};
export const STORE_HOSTS=['nosweatusa.com','www.nosweatusa.com','iyhxfe-mw.myshopify.com'];
export const VISITOR_DEVICES={desktop:'Masaüstü',mobile:'Mobil',tablet:'Tablet','ios-mobile':'iOS · Mobil','ios-tablet':'iOS · Tablet','android-mobile':'Android · Mobil','android-tablet':'Android · Tablet'};
export function visitorPath(value){
 if(typeof value!=='string'||value.length>512||/[?#@\\\s]/.test(value))return null;
 // Only public catalog/editorial routes. Never retain account, checkout, search or order URLs.
 return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:$|products\/[a-z0-9-]+\/?$|collections(?:\/[a-z0-9-]+(?:\/products\/[a-z0-9-]+)?)?\/?$|pages\/[a-z0-9-]+\/?$|blogs\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$)/i.test(value)?value:null;
}
export function attribution({source='',medium='',campaign='',referrer=''}={}){
 const clean=(v,max)=>typeof v==='string'&&/^[\p{L}\p{N} ._+:/-]*$/u.test(v)&&!v.includes('@')?v.slice(0,max):'';
 let host='';try{host=new URL(referrer).hostname.toLowerCase();}catch{}
 if(STORE_HOSTS.includes(host))host='';
 const s=clean(source,100)||host||'(direct)',m=clean(medium,60)||(host?'referral':'(none)');
 return {source:s,medium:m,campaign:clean(campaign,120),label:sourceLabel(s,m,'')};
}
export function visitorClick(type,target){
 if(type==='button'&&target==='')return {clickType:type,clickTarget:''};
 if(type==='internal'&&visitorPath(target))return {clickType:type,clickTarget:target};
 if(type==='outbound'&&typeof target==='string'&&target.length<=253&&/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(target)&&!STORE_HOSTS.includes(target))return {clickType:type,clickTarget:target};
 return null;
}
export function visitorDate(date,timeZone){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function visitorRange(period,timeZone,now=new Date()){
 if(!Object.hasOwn(VISITOR_PERIODS,period))throw new Error('Geçersiz ziyaret dönemi.');
 const today=visitorDate(now,timeZone),shift=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 return {start:shift(period==='week'?-6:period==='yesterday'?-1:0),end:shift(period==='yesterday'?-1:0)};
}
export function summarizeVisitors(events,{period='today',timeZone='America/New_York',now=new Date(),pages=[],limited=false}={}){
 const range=visitorRange(period,timeZone,now),visits=new Map(),daily=new Map(),countries=new Map(),sources=new Map(),products=new Map(),devices=new Map();
 const selected=events.filter(e=>{const day=visitorDate(new Date(e.occurredAt),timeZone);return day>=range.start&&day<=range.end;}).sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));
 const active=new Set(events.filter(e=>new Date(e.occurredAt)>=new Date(now-5*60000)&&new Date(e.occurredAt)<=now).map(e=>e.visit)).size;
 for(const e of selected){
  const at=new Date(e.occurredAt).toISOString(),day=attribution(e),date=visitorDate(new Date(at),timeZone);
  let visit=visits.get(e.visit);if(!visit){visit={id:e.visit.slice(0,10),country:e.country,source:e.source,medium:e.medium,campaign:e.campaign,label:day.label,device:e.device,firstAt:at,lastAt:at,views:0,clicks:0,timeline:[],pages:[]};visits.set(e.visit,visit);}
  visit.lastAt=at;if(e.kind==='page_viewed')visit.views++;
  if(e.kind==='clicked')visit.clicks++;
  const item={path:e.path,at,product:e.kind==='product_viewed',title:productInfo(e.path,pages).title,kind:e.kind,clickType:e.clickType||'',clickTarget:e.clickTarget||''};
  visit.timeline.push(item);
  if(e.kind!=='clicked'&&!visit.pages.some(p=>p.path===e.path&&p.at===at))visit.pages.push(item);
  let d=daily.get(date);if(!d){d={date,visits:new Set(),views:0};daily.set(date,d);}d.visits.add(e.visit);if(e.kind==='page_viewed')d.views++;
  if(e.kind==='product_viewed'){const p=products.get(e.path)||{...productInfo(e.path,pages),views:0};p.views++;products.set(e.path,p);}
 }
 for(const v of visits.values()){
  const device=v.device.startsWith('ios-')?'ios':v.device.startsWith('android-')?'android':v.device==='desktop'?'desktop':'other';
  const d=devices.get(device)||{device,visits:0,countries:{}};d.visits++;d.countries[v.country]=(d.countries[v.country]||0)+1;devices.set(device,d);
  const c=countries.get(v.country)||{code:v.country,visits:0,active:0};c.visits++;if(new Date(v.lastAt)>=new Date(now-5*60000))c.active++;countries.set(v.country,c);
  const k=JSON.stringify([v.source,v.medium,v.campaign]),s=sources.get(k)||{source:v.source,medium:v.medium,campaign:v.campaign,label:v.label,visits:0,countries:{}};s.visits++;s.countries[v.country]=(s.countries[v.country]||0)+1;sources.set(k,s);
 }
 return {period,...range,timeZone,generatedAt:now.toISOString(),limited,active,visits:visits.size,clicks:selected.filter(e=>e.kind==='clicked').length,views:selected.filter(e=>e.kind==='page_viewed').length,productViews:selected.filter(e=>e.kind==='product_viewed').length,daily:[...daily.values()].map(d=>({...d,visits:d.visits.size})),countries:[...countries.values()].sort((a,b)=>b.visits-a.visits),sources:[...sources.values()].sort((a,b)=>b.visits-a.visits),products:[...products.values()].sort((a,b)=>b.views-a.views),devices:[...devices.values()],recent:[...visits.values()].sort((a,b)=>b.lastAt.localeCompare(a.lastAt)).slice(0,100).map(v=>({...v,pages:v.pages.slice(-30).reverse(),timeline:v.timeline.slice(-50).reverse(),timelineLimited:v.timeline.length>50}))};
}

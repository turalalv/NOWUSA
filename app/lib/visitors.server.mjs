import crypto from 'node:crypto';
import {isIP} from 'node:net';
import geoip from 'geoip-country';
import {isbot} from 'isbot';
import {key,appOrigin} from './secrets.server.mjs';
import {STORE_HOSTS,visitorPath,attribution,summarizeVisitors} from './visitors.mjs';
import {visitorPixel} from './visitors-pixel.mjs';

const hmac=value=>crypto.createHmac('sha256',key()).update(value).digest('hex');
const buckets=new Map();let lastCleanup=0;
export function clientCountry(request){
 // Only use proxy headers on the managed hosts that supply them. This is approximate
 // analytics, never an authentication signal. IPs are not persisted or sent elsewhere.
 const header=process.env.RENDER?request.headers.get('x-forwarded-for'):process.env.VERCEL?request.headers.get('x-vercel-forwarded-for'):'';
 const ip=(header||'').split(',')[0].trim();return isIP(ip)?geoip.lookup(ip)?.country||'ZZ':'ZZ';
}
export function allowVisitorRequest(request,now=Date.now()){
 const forwarded=process.env.RENDER?request.headers.get('x-forwarded-for'):process.env.VERCEL?request.headers.get('x-vercel-forwarded-for'):'';
 const id=hmac(`rate:${(forwarded||'unknown').split(',')[0].slice(0,80)}`),minute=Math.floor(now/60000);
 if(buckets.size>5000)buckets.clear();
 for(const k of ['all',id]){const b=buckets.get(k);if(!b||b.minute!==minute)buckets.set(k,{minute,count:1});else if(++b.count>(k==='all'?3000:300))return false;}
 return true;
}
export async function cleanupVisitors(db,now=new Date()){return db.visitorEvent.deleteMany({where:{receivedAt:{lt:new Date(now-30*86400000)}}});}
export async function visitorConfiguration(db,shop){
 const row=await db.visitorTracker.findUnique({where:{shop}});
 return {configured:Boolean(row),enabled:row?.enabled||false,createdAt:row?.createdAt?.toISOString()||null};
}
export async function configureVisitors(db,shop,input){
 if(input.intent==='visitors-enable'){
  await db.visitorTracker.upsert({where:{shop},create:{shop,publicKey:crypto.randomBytes(24).toString('hex')},update:{enabled:true}});
  return {ok:true,message:'Ziyaret takibi hazır. Piksel kodunu Shopify Müşteri etkinlikleri bölümüne ekleyip bağlayın.'};
 }
 if(input.intent==='visitors-pause'){
  await db.visitorTracker.updateMany({where:{shop},data:{enabled:false}});return {ok:true,message:'Yeni ziyaretlerin kaydı durduruldu.'};
 }
 if(input.intent==='visitors-code'){
  const row=await db.visitorTracker.findUnique({where:{shop}});if(!row)throw new Error('Önce ziyaret takibini hazırlayın.');
  return {ok:true,download:visitorPixel({endpoint:appOrigin()+'/visitors/collect',publicKey:row.publicKey}),mime:'text/javascript;charset=utf-8',filename:'no-sweat-visitors-pixel.js'};
 }
 throw new Error('Geçersiz ziyaret işlemi.');
}
async function smallBody(request){
 if(Number(request.headers.get('content-length')||0)>4096)throw new Error('size');
 const reader=request.body?.getReader();if(!reader)throw new Error('body');
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new Error('size');}chunks.push(value);}}finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function collectVisitor(request,db,{now=new Date(),country=clientCountry,rate=allowVisitorRequest}={}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
 const response=status=>new Response(null,{status,headers});
 if(request.method==='OPTIONS')return response(204);
 if(request.method!=='POST')return response(405);
 const origin=request.headers.get('origin');
 if(origin&&origin!=='null'){try{const u=new URL(origin);if(u.protocol!=='https:'||!STORE_HOSTS.includes(u.hostname))return response(403);}catch{return response(403);}}
 if(isbot(request.headers.get('user-agent')||''))return response(204);
 if(!rate(request))return response(429);
 let body;try{body=await smallBody(request);}catch{return response(400);}
 if(!body||typeof body!=='object'||body.consent!==true||!STORE_HOSTS.includes(body.host)||!['page_viewed','product_viewed'].includes(body.kind)||!/^[-a-zA-Z0-9_]{8,160}$/.test(body.id||'')||!/^[a-f0-9-]{32,36}$/.test(body.visit||'')||!/^[a-f0-9]{48}$/.test(body.key||'')||!visitorPath(body.path)||!['desktop','mobile','tablet'].includes(body.device))return response(400);
 if(body.kind==='product_viewed'&&!body.path.includes('/products/'))return response(400);
 const occurredAt=new Date(body.at);if(!Number.isFinite(+occurredAt)||occurredAt>new Date(+now+60000)||occurredAt<new Date(now-86400000))return response(400);
 const config=await db.visitorTracker.findUnique({where:{publicKey:body.key}});
 if(!config?.enabled||config.shop!==process.env.ALLOWED_SHOP)return response(204);
 // Hard daily retention budget also bounds deliberate traffic inflation.
 const today=new Date(now.toISOString().slice(0,10)+'T00:00:00Z');
 if(await db.visitorEvent.count({where:{shop:config.shop,receivedAt:{gte:today}}})>=50000)return response(429);
 const source=attribution({source:body.source,medium:body.medium,campaign:body.campaign});
 const code=country(request);const countryCode=/^[A-Z]{2}$/.test(code)?code:'ZZ';
 const day=occurredAt.toISOString().slice(0,10);
 try{await db.visitorEvent.create({data:{id:hmac(`${config.shop}:event:${body.id}`),shop:config.shop,visit:hmac(`${config.shop}:visit:${day}:${body.visit}`),kind:body.kind,path:body.path,source:source.source,medium:source.medium,campaign:source.campaign,country:countryCode,device:body.device,occurredAt,receivedAt:now}});}
 catch(error){if(error?.code!=='P2002')throw error;}
 if(+now-lastCleanup>3600000){await cleanupVisitors(db,now);lastCleanup=+now;}
 return response(204);
}
export async function visitorReport(db,shop,period='today',now=new Date()){
 const [config,connection,workspace]=await Promise.all([visitorConfiguration(db,shop),db.trafficConnection.findUnique({where:{shop}}),db.seoWorkspace.findUnique({where:{shop}})]);
 const timeZone=connection?.timeZone||'America/New_York';
 const events=await db.visitorEvent.findMany({where:{shop,occurredAt:{gte:new Date(now-8*86400000),lte:now}},orderBy:{occurredAt:'desc'},take:30001,select:{visit:true,kind:true,path:true,source:true,medium:true,campaign:true,country:true,device:true,occurredAt:true}});
 const state=workspace?JSON.parse(workspace.data):{};
 return {config,report:summarizeVisitors(events.slice(0,30000),{period,timeZone,now,pages:state.catalog?.pages||[],limited:events.length>30000})};
}

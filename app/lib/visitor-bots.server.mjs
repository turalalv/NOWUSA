import crypto from 'node:crypto';
import {isbot} from 'isbot';
import {visitorPath,visitorRange,visitorDate} from './visitors.mjs';
import {key} from './secrets.server.mjs';

export function botFamily(ua){
 if(typeof ua!=='string'||!isbot(ua.slice(0,1024)))return '';
 for(const [pattern,label] of [[/googlebot/i,'Googlebot'],[/bingbot/i,'Bingbot'],[/gptbot|oai-searchbot|chatgpt-user/i,'OpenAI'],[/claudebot|claude-user|claude-searchbot/i,'Claude'],[/perplexity/i,'Perplexity'],[/facebookexternalhit|meta-externalagent/i,'Meta'],[/applebot/i,'Applebot'],[/ahrefs/i,'Ahrefs'],[/semrush/i,'Semrush']])if(pattern.test(ua))return label;
 return 'Diğer bot / otomasyon';
}
export async function recordBot(db,shop,{id,source,family,path,country,occurredAt},now=new Date()){
 const today=new Date(now.toISOString().slice(0,10)+'T00:00:00Z');
 if(await db.visitorBotEvent.count({where:{shop,receivedAt:{gte:today}}})>=10000)return false;
 const hash=crypto.createHmac('sha256',key()).update(`${shop}:bot:${source}:${id}`).digest('hex');
 try{await db.visitorBotEvent.create({data:{id:hash,shop,source,family,path,country,occurredAt,receivedAt:now}});return true;}catch(e){if(e?.code==='P2002')return false;throw e;}
}
// Authenticated manager import. Only bounded, normalized bot records survive;
// raw access logs, IPs and user-agent strings are never written to the database.
export async function importBotLogs(db,shop,text,now=new Date()){
 if(typeof text!=='string'||Buffer.byteLength(text)>250000)throw new Error('Dosya en fazla 250 KB olabilir.');
 let rows;try{rows=JSON.parse(text);}catch{throw new Error('JSON listesi okunamadı.');}
 if(!Array.isArray(rows)||rows.length>1000)throw new Error('En fazla 1.000 satırlık JSON listesi yükleyin.');
 let added=0,skipped=0;
 for(const row of rows){
  const family=botFamily(row?.user_agent),occurredAt=new Date(row?.timestamp);
  let path;try{path=visitorPath(new URL(row?.path,'https://nosweatusa.com').pathname);}catch{}
  if(!family||!path||!Number.isFinite(+occurredAt)||occurredAt>now||occurredAt<new Date(now-30*86400000)){skipped++;continue;}
  const country=/^[A-Z]{2}$/.test(row.country)?row.country:'ZZ';
  const id=JSON.stringify([occurredAt.toISOString(),path,family,country,String(row.request_id||'').slice(0,160)]);
  if(await recordBot(db,shop,{id,source:'server_log',family,path,country,occurredAt},now))added++;else skipped++;
 }
 return {ok:true,message:`${added} bot kaydı eklendi; ${skipped} geçersiz, insan, yinelenen veya sınır dışı kayıt atlandı.`};
}
export async function botReport(db,shop,{period,timeZone,now}){
 const range=visitorRange(period,timeZone,now);
 const rows=await db.visitorBotEvent.findMany({where:{shop,occurredAt:{gte:new Date(now-8*86400000),lte:now}},orderBy:{occurredAt:'desc'},take:10001});
 const selected=rows.slice(0,10000).filter(e=>{const day=visitorDate(e.occurredAt,timeZone);return day>=range.start&&day<=range.end;});
 const groups=new Map();for(const e of selected){const k=JSON.stringify([e.family,e.source]);const group=groups.get(k)||{family:e.family,source:e.source,count:0};group.count++;groups.set(k,group);}
 return {total:selected.length,pixel:selected.filter(e=>e.source==='pixel').length,serverLogs:selected.filter(e=>e.source==='server_log').length,limited:rows.length>10000,groups:[...groups.values()].sort((a,b)=>b.count-a.count),recent:selected.slice(0,20).map(({family,source,path,country,occurredAt})=>({family,source,path,country,at:occurredAt.toISOString()}))};
}

import https from 'node:https';
import {resolve4} from 'node:dns/promises';
export function isPublicIPv4(ip){const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&[0,168].includes(p[1])||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===198&&[18,19,51].includes(p[1])||p[0]===203&&p[1]===0&&p[2]===113);}
export function publicURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hostname.endsWith('.localhost')||u.hostname==='localhost')throw new Error('Yalnız açıq HTTPS ünvanı qəbul edilir.');u.hash='';return u;}
export async function publicFetch(value,{maxBytes=2_000_000,allowedHost=null,redirects=3,deadline=Date.now()+20000}={}){
 if(Date.now()>=deadline)throw new Error('Sorğu vaxt limiti keçildi.');
 const url=publicURL(value);if(allowedHost&&!allowedHost(url.hostname))throw new Error('Fayl Shopify CDN-də deyil.');
 let timer;const addresses=await Promise.race([resolve4(url.hostname),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS vaxt limiti keçildi.')),Math.min(5000,Math.max(1,deadline-Date.now())));})]).finally(()=>clearTimeout(timer));if(!addresses.length||addresses.some(ip=>!isPublicIPv4(ip)))throw new Error('Daxili şəbəkə ünvanı yoxlanmır.');
 const response=await new Promise((resolve,reject)=>{
  const req=https.get(url,{headers:{'user-agent':'NoSweatSEO/1.0','accept-encoding':'identity'},lookup:(_host,options,done)=>options.all?done(null,[{address:addresses[0],family:4}]):done(null,addresses[0],4)},res=>{
   const chunks=[];let length=0;res.on('data',chunk=>{length+=chunk.length;if(length>maxBytes){req.destroy(new Error('Fayl ölçü limitini keçir.'));return;}chunks.push(chunk);});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks),url:url.href}));res.on('error',reject);
  });const timer=setTimeout(()=>req.destroy(new Error('Sorğu vaxt limiti keçildi.')),Math.min(12000,Math.max(1,deadline-Date.now())));req.on('close',()=>clearTimeout(timer));req.on('error',reject);
 });
 if([301,302,303,307,308].includes(response.status)){if(!redirects||!response.headers.location)throw new Error('Yönləndirmə limiti keçildi.');return publicFetch(new URL(response.headers.location,url).href,{maxBytes,allowedHost,redirects:redirects-1,deadline});}
 return response;
}

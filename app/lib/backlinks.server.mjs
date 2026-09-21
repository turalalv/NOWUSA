import crypto from 'node:crypto';
import {publicFetch,publicURL} from './public-fetch.server.mjs';
import {plain} from './core/seo.mjs';
export function addBacklink(state,input){const url=publicURL(input.url);if(['nosweatusa.com','www.nosweatusa.com'].includes(url.hostname))throw new Error("Harici kaynak sayfasının URL’sini girin.");state.backlinks||=[];if(state.backlinks.length>=25)throw new Error("25 kaynak sayfası sınırına ulaşıldı.");if(state.backlinks.some(r=>r.url===url.href))throw new Error("Bu sayfa zaten listede.");state.backlinks.push({id:crypto.randomUUID(),url:url.href,status:'unchecked',links:[],checkedAt:null,note:''});}
export function inspectBacklinks(html,base){
 const clean=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi,'');const links=[];
 for(const m of clean.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);if(!href)continue;
  try{const u=new URL((href[1]??href[2]??href[3]).replaceAll('&amp;','&'),base);if(!['https:','http:'].includes(u.protocol)||!['nosweatusa.com','www.nosweatusa.com'].includes(u.hostname))continue;
   const rel=m[1].match(/(?:^|\s)rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);links.push({url:u.href,anchor:plain(m[2]).slice(0,200),rel:(rel?.[1]??rel?.[2]??rel?.[3]??'').toLowerCase()});
  }catch{/* Ignore malformed links. */}
 }
 return {links:links.slice(0,50),mentioned:/\bno\s+sweat\s+usa\b/i.test(plain(clean))};
}
export async function checkBacklinks(state,fetcher=publicFetch){state.backlinks||=[];for(const row of state.backlinks){row.links=[];try{const response=await fetcher(row.url);row.checkedAt=new Date().toISOString();row.http=response.status;if(response.status!==200){row.status='unknown';row.note=`HTTP ${response.status}: bağlantının kaybolduğu doğrulanamıyor.`;continue;}const result=inspectBacklinks(response.bytes.toString('utf8'),response.url);row.links=result.links;row.status=result.links.length?'found':result.mentioned?'mention':'missing';row.note="Sunucu HTML kontrolüdür; JavaScript bağlantıları ve Google dizine ekleme durumu kontrol edilmez.";}catch{row.status='unknown';row.note="Sayfa kontrol edilemedi: ağ, boyut veya adres kısıtlaması.";row.checkedAt=new Date().toISOString();}}return `${state.backlinks.length} backlink kaynağı kontrol edildi.`;}
export function backlinkOpportunities(pages){return [...new Set(['"No Sweat USA" -site:nosweatusa.com',...pages.slice(0,5).map(p=>`"${String(p.title).replaceAll('"','').slice(0,100)}" review -site:nosweatusa.com`)])].map(query=>({query,url:`https://www.google.com/search?q=${encodeURIComponent(query)}`}));}

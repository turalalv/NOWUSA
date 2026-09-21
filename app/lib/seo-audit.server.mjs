import crypto from 'node:crypto';
import process from 'node:process';
import {validateAuditConfig,auditURL,robotsAllows,auditLines} from './audit-config.mjs';
import {fetchPage,storefrontURL} from './technical.server.mjs';
import {inspectHTML} from './core/shopify.mjs';
const plain=html=>html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
export async function advancedAudit(catalog,fetcher=fetch,settings={}){
 const config=validateAuditConfig(settings),base=`https://${config.host}/`,seen=new Set(),pages=[],warnings=[],skipped=[];const deadline=Date.now()+180000;
 let robots='';if(!config.ignoreRobots){try{const r=await fetchPage(new URL('robots.txt',base).href,{fetcher});if(r.status===200)robots=r.html;else if(r.status===429||r.status>=500)throw new Error();}catch{throw new Error('robots.txt alınamadı; güvenli tarama için yeniden deneyin veya kendi sitenizde geçersiz kılma seçimini kullanın.');}}
 const accepted=value=>{const url=auditURL(value,base,config);return url&&(config.ignoreRobots||robotsAllows(robots,url))?url:null;};
 const seed=config.source==='urls'?auditLines(config.urls):config.source==='site'?[base,...catalog.map(p=>p.url).filter(Boolean)]:[];
 const queue=[...new Set(seed.map(accepted).filter(Boolean))],maps=[new URL('sitemap.xml',base).href],sitemapURLs=new Set();
 if(config.source!=='urls')for(let i=0;i<maps.length&&i<4;i++){try{const r=await fetchPage(maps[i],{fetcher,keepQuery:true});if(r.status!==200)continue;for(const m of r.html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)){const raw=m[1].replaceAll('&amp;','&'),url=storefrontURL(raw,base,true);if(!url)continue;if(/\/sitemap[^/]*\.xml$/.test(new URL(url).pathname)){if(!maps.includes(url)&&maps.length<4)maps.push(url);}else{const page=accepted(url);if(page&&sitemapURLs.size<200){sitemapURLs.add(page);if(!queue.includes(page))queue.push(page);}}}}catch{warnings.push('Bir site haritası alınamadı; keşif kapsamı eksik olabilir.');}}
 const userAgent=config.device==='mobile'?'Mozilla/5.0 (Linux; Android 10; Mobile) NoSweatSEO/1.0':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NoSweatSEO/1.0';
 // Sequential requests enforce the requested crawl delay, including discovered pages.
 for(let offset=0;offset<queue.length&&pages.length<config.maxPages&&Date.now()<deadline;offset++){
  const url=queue[offset];if(seen.has(url))continue;seen.add(url);if(offset&&config.delayMs)await new Promise(resolve=>setTimeout(resolve,config.delayMs));
  try{const r=await fetchPage(url,{fetcher,keepQuery:!config.removeAllParams,userAgent,allowURL:value=>Boolean(accepted(value))});const technical=r.status===200?inspectHTML(r.html):null;const links=[];
   if(technical){const markup=r.html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi,'');for(const tag of markup.matchAll(/<a\b[^>]*>/gi)){if(!config.followNofollow&&/\brel\s*=\s*["'][^"']*\bnofollow\b/i.test(tag[0]))continue;const href=tag[0].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);if(href){let raw;try{raw=new URL((href[1]??href[2]).replaceAll('&amp;','&'),r.url).href;}catch{continue;}const link=accepted(raw);if(link)links.push(link);else if(skipped.length<100)skipped.push(raw);}}}
   const main=r.html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||r.html,content=plain(main);
   pages.push({url,finalURL:r.url,status:r.status,title:technical?.title||url,technical:technical?{title:technical.title,description:technical.description,canonical:technical.canonical,h1Count:technical.h1Count,noindex:technical.noindex||/noindex/i.test(r.xRobots),invalidSchema:technical.invalidSchema}:null,redirects:r.redirects,elapsedMs:r.elapsedMs,bytes:r.bytes,links,hash:content.length>=100?crypto.createHash('sha256').update(content).digest('hex'):null});
   if(config.source!=='urls')for(const link of links)if(!queue.includes(link)&&queue.length<200)queue.push(link);
  }catch{pages.push({url,title:url,status:null,error:'Sayfa alınamadı veya kural nedeniyle yönlendirme izlenmedi.',links:[],redirects:[]});}
 }
 if(!pages.length)warnings.push('Seçilen kaynak ve kurallar kapsamında taranabilir sayfa bulunamadı.');
 if(queue.length>pages.length)warnings.push(`${queue.length} keşfedilen URL içinden ${pages.length} sayfa tarandı. Sınır: ${config.maxPages} sayfa / 3 dakika.`);
 const incoming=new Set(pages.flatMap(p=>p.links.filter(u=>u!==p.url))),findings=[];
 const add=(type,p,detail)=>findings.push({type,url:p.url,detail});
 for(const p of pages){if([404,410].includes(p.status))add('Kırık sayfa',p,`HTTP ${p.status}`);if(p.status===null||[403,429].includes(p.status))add('Kontrol edilemedi',p,'Erişim veya ağ sınırlaması; kırık sayfa olarak sayılmaz.');if(p.redirects.length>1)add('Yönlendirme zinciri',p,`${p.redirects.length} yönlendirme`);if(p.technical?.noindex)add('Noindex',p,'Meta veya HTTP başlığında noindex var.');if(p.technical&&p.technical.h1Count!==1)add('H1',p,`${p.technical.h1Count} H1 bulundu.`);if(p.technical&&!p.technical.canonical)add('Canonical eksik',p,'Canonical bağlantısı bulunamadı.');if(p.technical?.invalidSchema)add('Şema sözdizimi',p,'JSON-LD çözümlenemedi.');if(p.elapsedMs>3000)add('Yavaş HTML yanıtı',p,`${p.elapsedMs} ms; tarayıcı yüklenme süresi değildir.`);if(sitemapURLs.has(p.url)&&!incoming.has(p.url)&&new URL(p.url).pathname!=='/')add('Bağlantısız sayfa adayı',p,'Taranan sayfalarda gelen bağlantı bulunmadı; tüm site için kesin sonuç değildir.');}
 for(const [field,label] of [['title','Aynı başlık'],['description','Aynı meta açıklama'],['hash','Aynı metin']]){const groups=new Map();for(const p of pages.filter(p=>p.status===200)){const value=field==='hash'?p.hash:p.technical?.[field]?.trim().toLowerCase();if(!value)continue;const group=groups.get(value)||[];group.push(p);groups.set(value,group);}for(const group of groups.values())if(group.length>1)for(const p of group)add(label,p,`${group.length} sayfada aynı değer bulundu.`);}
 const result={config,skippedCount:skipped.length,checkedAt:new Date().toISOString(),pages:pages.map(p=>{const saved={...p};delete saved.hash;delete saved.links;return saved;}),findings,warnings,sitemapCount:sitemapURLs.size,partial:queue.length>pages.length};return result;
}
export async function pageSpeed(fetcher=fetch){
 const rows=[];
 for(const device of ['mobile','desktop']){const u=new URL('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed');u.searchParams.set('url','https://nosweatusa.com/');u.searchParams.set('strategy',device);u.searchParams.set('category','performance');if(process.env.PAGESPEED_API_KEY)u.searchParams.set('key',process.env.PAGESPEED_API_KEY);
  try{const r=await fetcher(u,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error();const json=await r.json(),l=json.lighthouseResult;if(l?.runtimeError||typeof l?.categories?.performance?.score!=='number')throw new Error();const a=l.audits;rows.push({device,score:Math.round(l.categories.performance.score*100),lcp:a['largest-contentful-paint']?.displayValue||'—',cls:a['cumulative-layout-shift']?.displayValue||'—',tbt:a['total-blocking-time']?.displayValue||'—',checkedAt:l.fetchTime});}catch{rows.push({device,error:'PageSpeed verisi alınamadı. Kota/API anahtarı veya sayfa erişimini kontrol edin.'});}
 }return {checkedAt:new Date().toISOString(),url:'https://nosweatusa.com/',rows};
}

import { inspectHTML } from './core/shopify.mjs';

const allowedHosts = new Set(['nosweatusa.com','www.nosweatusa.com']);
export function storefrontURL(value, base='https://nosweatusa.com',keepQuery=false) {
  try {
    const url=new URL(value,base);
    if(url.protocol!=='https:'||!allowedHosts.has(url.hostname)||url.port||url.username||url.password)return null;
    if(!/^\/(?:$|products\/|collections\/|pages\/|blogs\/|robots\.txt$|sitemap(?:_[a-zA-Z0-9_-]+)?\.xml$)/.test(url.pathname))return null;
    if(!keepQuery)url.search='';url.hash='';return url.href;
  }catch{return null;}
}
export async function fetchPage(input, {head=false, fetcher=fetch,keepQuery=false,userAgent='NoSweatSEO/1.0 (owner-requested audit)',allowURL=()=>true}={}) {
  let url=storefrontURL(input,undefined,keepQuery);if(!url)throw new Error("Yalnızca No Sweat USA’nın herkese açık sayfaları kontrol edilir.");
  const signal=AbortSignal.timeout(8000),started=Date.now(),redirects=[];
  for(let i=0;i<5;i++){
    if(!allowURL(url))throw new Error('URL tarama kuralları tarafından engellendi.');
    const response=await fetcher(url,{method:head?'HEAD':'GET',redirect:'manual',signal,headers:{'user-agent':userAgent}});
    if([301,302,303,307,308].includes(response.status)){
      const next=storefrontURL(response.headers.get('location')||'',url,keepQuery);
      await response.body?.cancel();if(!next)throw new Error("Başka alan adına veya kapalı yola yönlendirme takip edilmedi.");redirects.push({from:url,to:next,status:response.status});url=next;continue;
    }
    if(head){await response.body?.cancel();return {url,status:response.status,html:'',redirects,elapsedMs:Date.now()-started,bytes:0,xRobots:response.headers.get('x-robots-tag')||''};}
    const chunks=[];let bytes=0;
    if(response.body)for await(const chunk of response.body){bytes+=chunk.length;if(bytes>2_500_000){throw new Error("HTML, 2,5 MB kontrol sınırını aşıyor.");}chunks.push(chunk);}
    return {url,status:response.status,html:Buffer.concat(chunks).toString('utf8'),redirects,elapsedMs:Date.now()-started,bytes,xRobots:response.headers.get('x-robots-tag')||''};
  }
  throw new Error("Yönlendirme sınırı aşıldı.");
}
export function extractLinks(html,base) {
  const markup=html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const links=new Set();
  for(const m of markup.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
    const url=storefrontURL((m[1]??m[2]).replaceAll('&amp;','&'),base);if(url)links.add(url);
  }
  return [...links];
}
export async function technicalAudit(pages,fetcher=fetch){
  const inspected=[],linkSources=new Map(),warnings=[];
  const selected=pages.filter(p=>p.url&&storefrontURL(p.url)).slice(0,30);
  if(pages.filter(p=>p.url).length>30)warnings.push("Teknik denetim, yayınlanmış ilk 30 sayfayı kapsar.");
  for(let offset=0;offset<selected.length;offset+=3){await Promise.all(selected.slice(offset,offset+3).map(async p=>{
    try{
      const r=await fetchPage(p.url,{fetcher}), html=r.status===200?inspectHTML(r.html):null;
      inspected.push({pageId:p.id,title:p.title,url:p.url,finalURL:r.url,status:r.status,technical:html});
      if(r.status===200)for(const link of extractLinks(r.html,r.url)){if(!linkSources.has(link))linkSources.set(link,[]);linkSources.get(link).push(p.title);}
    }catch(error){inspected.push({pageId:p.id,title:p.title,url:p.url,status:null,error:error.message,technical:null});}
  }));}
  const already=new Map(inspected.filter(p=>p.status).map(p=>[storefrontURL(p.url),p.status]));
  const links=[];const urls=[...linkSources.keys()].slice(0,60);
  if(linkSources.size>60)warnings.push(`${linkSources.size} benzersiz dahili bağlantının ilk 60’ı kontrol edildi.`);
  for(let offset=0;offset<urls.length;offset+=5){await Promise.all(urls.slice(offset,offset+5).map(async url=>{
    try{let status=already.get(url);if(!status){let r=await fetchPage(url,{head:true,fetcher});if(r.status===405)r=await fetchPage(url,{fetcher});status=r.status;}links.push({url,status,broken:[404,410].includes(status),sources:[...new Set(linkSources.get(url))]});}
    catch(error){links.push({url,status:null,broken:false,error:error.message,sources:[...new Set(linkSources.get(url))]});}
  }));}
  const infrastructure=await Promise.all(['robots.txt','sitemap.xml'].map(async name=>{try{const r=await fetchPage(`https://nosweatusa.com/${name}`,{fetcher});return {name,status:r.status,valid:r.status===200&&(name==='sitemap.xml'?/<(?:sitemapindex|urlset)\b/.test(r.html):/user-agent:/i.test(r.html))};}catch{return {name,status:null,valid:false};}}));
  return {checkedAt:new Date().toISOString(),pages:inspected.map(p=>{if(p.technical)delete p.technical.images;return p;}),links:links.sort((a,b)=>Number(b.broken)-Number(a.broken)),infrastructure,warnings};
}

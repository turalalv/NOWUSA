export const TRAFFIC_PERIODS={today:'Bugün',yesterday:'Dün',week:'Son 7 tamamlanmış gün',previousWeek:'Önceki 7 gün'};
export function trafficRange(period='week',timeZone='America/New_York',now=new Date()){
 if(!Object.hasOwn(TRAFFIC_PERIODS,period))throw new Error('Geçersiz ziyaret dönemi.');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const shift=n=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const [start,end]=period==='today'?[0,0]:period==='yesterday'?[-1,-1]:period==='week'?[-7,-1]:[-14,-8];
 const length=end-start+1;
 return {period,start:shift(start),end:shift(end),previousStart:shift(start-length),previousEnd:shift(end-length),timeZone,partial:period==='today'};
}
export function countryFlag(code){return /^[A-Z]{2}$/.test(code||'')&&code!=='ZZ'?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'🌐';}
export function sourceLabel(source,medium,channel){
 const s=(source||'').toLowerCase();
 if(s==='(direct)')return 'Direct / kaynağı belirtilmeyen';
 if(!s||s==='(not set)'||s==='(data not available)')return 'Bilinmeyen kaynak';
 const host=s.replace(/^https?:\/\//,'').split('/')[0];
 const is=d=>host===d||host.endsWith(`.${d}`);
 const platform=['instagram','ig'].includes(s)||is('instagram.com')?'Instagram':['tiktok','tik tok'].includes(s)||is('tiktok.com')?'TikTok':['facebook','fb','meta'].includes(s)||is('facebook.com')?'Facebook':s==='google'||is('google.com')?'Google':s==='bing'||is('bing.com')?'Bing':s==='youtube'||is('youtube.com')?'YouTube':source;
 const paid=/^(Paid |Display$|Cross-network$)/i.test(channel||'')||/^(cpc|ppc|paid|paid_social|paidsocial|paid-social|paid_search|display|cpm|cpv)$/i.test(medium||'');
 return `${platform}${paid?' · Reklam':''}`;
}
export function trafficData(state){return {auto:state.traffic?.auto||false,reports:state.traffic?.reports||{}};}
export function productInfo(path,pages=[]){
 const clean=String(path||'').split('?')[0];
 const page=pages.find(p=>p.type==='product'&&(()=>{try{return new URL(p.url).pathname===clean;}catch{return false;}})());
 let fallback=clean;try{fallback=decodeURIComponent(clean.split('/').filter(Boolean).at(-1)||clean).replace(/-/g,' ');}catch{}
 return {path:clean,title:page?.title||fallback,image:page?.images?.[0]?.url||''};
}

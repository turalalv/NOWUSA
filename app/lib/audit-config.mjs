export const defaultAuditConfig={name:'Mağaza denetimi',host:'nosweatusa.com',maxPages:30,source:'site',urls:'',device:'mobile',delayMs:500,allow:'',disallow:'',removeAllParams:true,removeParams:'utm_*\ngclid\nfbclid',ignoreRobots:false,followNofollow:false};
const lines=value=>String(value||'').split('\n').map(v=>v.trim()).filter(Boolean);
export function validateAuditConfig(input={}){
 const c={...defaultAuditConfig,...input};
 if(typeof c.name!=='string'||!c.name.trim()||c.name.length>80||!['nosweatusa.com','www.nosweatusa.com'].includes(c.host)||![10,30,60].includes(Number(c.maxPages))||!['site','sitemap','urls'].includes(c.source)||!['mobile','desktop'].includes(c.device)||![0,500,1000,2000].includes(Number(c.delayMs)))throw new Error('Denetim ayarları geçersiz.');
 for(const key of ['urls','allow','disallow','removeParams'])if(typeof c[key]!=='string'||c[key].length>8000||lines(c[key]).length>100)throw new Error('Kural listesi çok uzun.');
 for(const key of ['removeAllParams','ignoreRobots','followNofollow'])if(typeof c[key]!=='boolean')throw new Error('Denetim seçimi geçersiz.');
 if([...lines(c.allow),...lines(c.disallow)].some(v=>!v.startsWith('/')||v.length>200))throw new Error('İzin kuralları / ile başlayan yol kalıpları olmalıdır.');
 if(lines(c.removeParams).some(v=>!/^[-\w*]{1,80}$/.test(v)))throw new Error('Parametre adı geçersiz.');
 if(c.source==='urls'&&!lines(c.urls).length)throw new Error('En az bir başlangıç URL’si girin.');
 for(const value of lines(c.urls)){let u;try{u=new URL(value);}catch{throw new Error('Başlangıç URL’si geçersiz.');}if(u.protocol!=='https:'||u.hostname!==c.host||u.username||u.password||u.port)throw new Error('Başlangıç URL’leri seçilen mağaza alan adına ait HTTPS adresleri olmalıdır.');}
 return {...c,name:c.name.trim(),maxPages:Number(c.maxPages),delayMs:Number(c.delayMs)};
}
export function glob(pattern,value){const expression=pattern.split('*').map(p=>p.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*');return new RegExp(`^${expression}`).test(value);}
export function auditURL(value,base,config){try{const u=new URL(value,base);if(u.protocol!=='https:'||!['nosweatusa.com','www.nosweatusa.com'].includes(u.hostname)||u.username||u.password||u.port)return null;if(!/^\/(?:$|products\/|collections\/|pages\/|blogs\/)/.test(u.pathname))return null;u.hash='';if(config.removeAllParams)u.search='';else{for(const k of [...u.searchParams.keys()])if(lines(config.removeParams).some(p=>(p.endsWith('*')?k.startsWith(p.slice(0,-1)):k===p)))u.searchParams.delete(k);u.searchParams.sort();}const path=u.pathname+u.search;const allow=lines(config.allow),deny=lines(config.disallow);if(deny.some(p=>glob(p,path))||(allow.length&&!allow.some(p=>glob(p,path))))return null;return u.href;}catch{return null;}}
export function robotsAllows(text,url){
 const groups=[];let group=null,hasRules=false;
 for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim(),m=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;const key=m[1].toLowerCase(),value=m[2].trim();if(key==='user-agent'){if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}group.agents.push(value.toLowerCase());}else if(group&&['allow','disallow'].includes(key)){hasRules=true;if(value)group.rules.push({allow:key==='allow',path:value});}}
 const specific=groups.filter(g=>g.agents.some(a=>a==='nosweatseo'));const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));const path=new URL(url).pathname+new URL(url).search;
 const matched=selected.flatMap(g=>g.rules).filter(r=>{const end=r.path.endsWith('$');const raw=end?r.path.slice(0,-1):r.path;const re=raw.split('*').map(p=>p.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*');return new RegExp(`^${re}${end?'$':''}`).test(path);}).sort((a,b)=>b.path.replace(/\*/g,'').length-a.path.replace(/\*/g,'').length||Number(b.allow)-Number(a.allow));return matched[0]?.allow??true;
}
export {lines as auditLines};

import crypto from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {appOrigin,hash,seal,unseal,key,equal} from './secrets.server.mjs';
const scope='https://www.googleapis.com/auth/webmasters.readonly';
export function googleConfigured(){try{key();return Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&appOrigin());}catch{return false;}}
function client(){if(!googleConfigured())throw new Error("Google bağlantısı için sunucuda OAuth ayarları yapılmalıdır.");return new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,`${appOrigin()}/google/callback`);}
export function ownProperty(property){try{if(property==='sc-domain:nosweatusa.com')return true;const u=new URL(property);return u.protocol==='https:'&&['nosweatusa.com','www.nosweatusa.com'].includes(u.hostname)&&u.pathname==='/'&&!u.search&&!u.hash&&!u.port&&!u.username&&!u.password;}catch{return false;}}
export async function googleStatus(db,shop){const row=await db.googleConnection.findUnique({where:{shop}});return {configured:googleConfigured(),connected:Boolean(row),properties:row?JSON.parse(row.properties):[],property:row?.property||'',autoSync:row?.autoSync||false,syncedAt:row?.syncedAt?.toISOString()||null};}
export async function prepareGoogle(db,shop){client();const ticket=crypto.randomBytes(32).toString('hex');await db.googleOAuth.deleteMany({where:{OR:[{shop},{expiresAt:{lt:new Date()}}]}});await db.googleOAuth.create({data:{shop,ticketHash:hash(ticket),expiresAt:new Date(Date.now()+600000)}});return `${appOrigin()}/google/connect?ticket=${ticket}`;}
export async function startGoogle(db,ticket){
 if(!/^[a-f0-9]{64}$/.test(ticket||''))throw new Error("Bağlantı adresi geçerli değil.");
 const row=await db.googleOAuth.findUnique({where:{ticketHash:hash(ticket)}});if(!row||row.expiresAt<new Date())throw new Error("Bağlantının süresi doldu.");
 const state=crypto.randomBytes(32).toString('hex'),oauth=client();const {codeVerifier,codeChallenge}=await oauth.generateCodeVerifierAsync();
 const consumed=await db.googleOAuth.updateMany({where:{id:row.id,ticketHash:hash(ticket),expiresAt:{gt:new Date()}},data:{ticketHash:null,stateHash:hash(state),verifier:seal(codeVerifier,row.shop)}});if(consumed.count!==1)throw new Error("Bağlantı zaten kullanıldı.");
 const url=oauth.generateAuthUrl({access_type:'offline',scope:[scope],prompt:'consent',state,code_challenge:codeChallenge,code_challenge_method:'S256'});
 return {url,cookie:`nosweat_google_state=${state}; Path=/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`};
}
export async function finishGoogle(db,{state,code,cookie,error},oauthFactory=client){
 const browserState=(cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('nosweat_google_state='))?.slice(21);
 if(!/^[a-f0-9]{64}$/.test(state||'')||!equal(state,browserState))throw new Error("Google bağlantısı, başlatıldığı tarayıcıda tamamlanmalıdır.");
 const row=await db.googleOAuth.findUnique({where:{stateHash:hash(state)}});if(!row||row.expiresAt<new Date())throw new Error("Google bağlantısının süresi doldu. Yeniden başlayın.");
 const consumed=await db.googleOAuth.deleteMany({where:{id:row.id,stateHash:hash(state)}});if(consumed.count!==1)throw new Error("Google yanıtı zaten kullanıldı.");
 if(error||!code)throw new Error("Google izni verilmedi. Yeniden bağlanabilirsiniz.");
 const oauth=oauthFactory();let tokens;
 try{({tokens}=await oauth.getToken({code,codeVerifier:unseal(row.verifier,row.shop)}));}catch{throw new Error("Google giriş kodu kabul edilmedi. Yeniden bağlanın.");}
 if(!tokens.refresh_token||!tokens.scope?.split(' ').includes(scope))throw new Error("Google okuma ve çevrimdışı erişim izni alınamadı. Yeniden bağlanın.");
 oauth.setCredentials(tokens);let properties;
 try{const r=await oauth.request({url:'https://www.googleapis.com/webmasters/v3/sites',timeout:15000});properties=(r.data.siteEntry||[]).filter(s=>s.permissionLevel!=='siteUnverifiedUser'&&ownProperty(s.siteUrl)).map(s=>s.siteUrl);}catch{throw new Error("Search Console siteleri alınamadı. Google Cloud’da API’yi etkinleştirin.");}
 if(!properties.length)throw new Error("Bu Google hesabında nosweatusa.com Search Console mülkü bulunamadı.");
 await db.$transaction(async tx=>{if(!await tx.seoWorkspace.findUnique({where:{shop:row.shop}}))throw new Error("Shopify uygulaması artık bağlı değil.");await tx.googleConnection.upsert({where:{shop:row.shop},create:{shop:row.shop,tokens:seal(tokens,row.shop),properties:JSON.stringify(properties),property:properties[0]},update:{tokens:seal(tokens,row.shop),properties:JSON.stringify(properties),property:properties[0],syncedAt:null}});});
 return row.shop;
}
export function dateRange(now=new Date()){
 // Search Console groups dates in Pacific time. Leave three days for finalized data.
 const pacific=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const end=new Date(`${pacific}T00:00:00Z`);end.setUTCDate(end.getUTCDate()-3);const start=new Date(end);start.setUTCDate(start.getUTCDate()-27);
 const previousEnd=new Date(start);previousEnd.setUTCDate(previousEnd.getUTCDate()-1);const previousStart=new Date(previousEnd);previousStart.setUTCDate(previousStart.getUTCDate()-27);
 return [[start,end],[previousStart,previousEnd]].map(pair=>pair.map(d=>d.toISOString().slice(0,10)));
}
export async function fetchGoogleReport(oauth,property,startDate,endDate,{dimensions=['page'],country=null,maxRows=50000}={}){
 const rows=[];let truncated=false;const rowLimit=Math.min(25000,maxRows);
 for(let startRow=0;startRow<maxRows;startRow+=rowLimit){
  const data={startDate,endDate,dimensions,type:'web',dataState:'final',rowLimit,startRow};
  if(country)data.dimensionFilterGroups=[{groupType:'and',filters:[{dimension:'country',operator:'equals',expression:country}]}];
  const r=await oauth.request({url:`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,method:'POST',timeout:20000,data});
  const batch=r.data.rows||[];
  for(const row of batch){
   if(!Array.isArray(row.keys)||row.keys.length!==dimensions.length||![row.clicks,row.impressions,row.position].every(n=>Number.isFinite(n)&&n>=0)||row.clicks>row.impressions)throw new Error("Google raporunun biçimi geçerli değil.");
   const values=Object.fromEntries(dimensions.map((dimension,i)=>[dimension,row.keys[i]]));
   rows.push({page:values.page||'',query:values.query||'',...(values.date?{date:values.date}:{}),clicks:row.clicks,impressions:row.impressions,ctr:row.impressions?row.clicks/row.impressions:0,position:row.position});
  }
  if(batch.length<rowLimit)break;if(startRow+rowLimit>=maxRows)truncated=true;
 }
 const grain=dimensions.includes('date')?'page-date':dimensions.includes('query')?'page-query':'page';
 return {property,startDate,endDate,grain,country:country||'all',device:'all',searchType:'web',rows,importedAt:new Date().toISOString(),source:'google-api',truncated};
}
export async function syncGoogle(db,shop,state,oauthFactory=client){
 const row=await db.googleConnection.findUnique({where:{shop}});if(!row?.property||!ownProperty(row.property))throw new Error("Önce Google hesabını bağlayın.");
 const oauth=oauthFactory();oauth.setCredentials(unseal(row.tokens,shop));let reports,detailed;
 try{
  await oauth.getAccessToken();reports=[];detailed=[];
  for(const [start,end] of dateRange()){
   reports.push(await fetchGoogleReport(oauth,row.property,start,end,{country:'usa'}));
   detailed.push(await fetchGoogleReport(oauth,row.property,start,end,{country:'usa',dimensions:['query','page'],maxRows:10000}));
   detailed.push(await fetchGoogleReport(oauth,row.property,start,end,{country:'usa',dimensions:['page','date'],maxRows:10000}));
  }
 }catch{throw new Error("Google raporu alınamadı. Hesap iznini ve API bağlantısını kontrol edin; gerekirse yeniden bağlanın.");}
 const saved=await db.googleConnection.updateMany({where:{shop,tokens:row.tokens},data:{tokens:seal(oauth.credentials,shop),syncedAt:new Date()}});if(!saved.count)throw new Error("Google bağlantısı değişti; işlemi tekrarlayın.");
 // No workspace changes until all six requests succeed. USA and global reports never overwrite each other.
 state.gsc=state.gsc.filter(r=>!reports.some(n=>n.property===r.property&&n.grain===r.grain&&n.country===r.country&&n.startDate===r.startDate&&n.endDate===r.endDate));state.gsc.push(...reports);state.gsc=state.gsc.slice(-24);
 state.growth||={};state.growth.reports=detailed;
 state.growth.syncedAt=new Date().toISOString();
 return [...reports,...detailed].some(r=>r.truncated)?"ABD raporları getirildi. Bazı raporlarda satır sınırına ulaşıldı; kısıtlama panelde gösterilir.":"ABD için ürün, anahtar kelime ve günlük Google raporları getirildi.";
}

export async function disconnectGoogle(db,shop){
 const row=await db.googleConnection.findUnique({where:{shop}});let revoked=!row;
 if(row){try{const oauth=client();const t=unseal(row.tokens,shop);await oauth.revokeToken(t.refresh_token||t.access_token);revoked=true;}catch{/* Delete local credentials even if Google is unavailable. */}}
 await db.googleConnection.deleteMany({where:{shop}});await db.googleOAuth.deleteMany({where:{shop}});
 return revoked?"Google bağlantısı kaldırıldı.":"Yerel Google bağlantısı silindi. Google hesabının üçüncü taraf erişimleri bölümünden izni de iptal edin.";
}

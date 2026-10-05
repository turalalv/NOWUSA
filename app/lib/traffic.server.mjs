import crypto from 'node:crypto';
import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {appOrigin,key,hash,seal,unseal,equal} from './secrets.server.mjs';
import {trafficRange,sourceLabel,productInfo} from './traffic.mjs';
const scope='https://www.googleapis.com/auth/analytics.readonly';
const adminURL='https://analyticsadmin.googleapis.com/v1beta/';
const hosts=['nosweatusa.com','www.nosweatusa.com','iyhxfe-mw.myshopify.com'];
function oauthClient(){return new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,`${appOrigin()}/google/callback`);}
function credentials(){
 const encoded=process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;if(!encoded)return null;
 try{const c=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));if(c.type!=='service_account'||!c.client_email?.endsWith('.iam.gserviceaccount.com')||!c.private_key)throw new Error();return c;}catch{throw new Error('Google hizmet hesabı ayarı geçersiz.');}
}
export async function trafficStatus(db,shop){
 const row=await db.trafficConnection.findUnique({where:{shop}});let email='';try{email=credentials()?.client_email||'';}catch{}
 let configured=false;try{key();configured=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&appOrigin());}catch{}
 return {connected:Boolean(row),configured,serviceEmail:email,property:row?.property||'',name:row?.name||'',timeZone:row?.timeZone||'',measurementId:row?.measurementId||'',properties:row?JSON.parse(row.properties):[]};
}
function apiError(error){
 const details=error?.response?.data?.error;
 if(details?.status==='PERMISSION_DENIED')return new Error('GA4 okuma izni yok veya Analytics Admin / Data API kapalı. Mülk erişimini ve Google Cloud API ayarlarını kontrol edin.');
 if(details==='invalid_grant')return new Error('Analytics bağlantısının süresi doldu. Google hesabını yeniden bağlayın.');
 if(['Bu hesapta nosweatusa.com GA4 web akışı bulunamadı. Doğru Analytics hesabıyla bağlanın.','Bu GA4 mülkünde nosweatusa.com web akışı bulunamadı.'].includes(error?.message))return error;
 return new Error('Analytics verileri alınamadı. Bağlantıyı, mülk iznini ve API ayarlarını kontrol edin. Önceki rapor korunuyor.');
}
async function list(client,path,field){
 let token='';const rows=[];
 for(let i=0;i<10;i++){const r=await client.request({url:adminURL+path,params:{pageSize:200,...(token?{pageToken:token}:{})},timeout:20000});rows.push(...(r.data[field]||[]));token=r.data.nextPageToken;if(!token)return rows;}
 throw new Error('Analytics mülk listesi sınırı aşıldı. Daha dar erişimli bir hesap kullanın.');
}
export async function verifyTrafficProperty(client,property){
 if(!/^properties\/\d+$/.test(property))throw new Error('Geçerli bir GA4 mülkü seçin.');
 const streams=await list(client,`${property}/dataStreams`,'dataStreams');
 const own=streams.filter(s=>{try{return s.type==='WEB_DATA_STREAM'&&hosts.includes(new URL(s.webStreamData?.defaultUri).hostname);}catch{return false;}});
 if(!own.length)throw new Error('Bu GA4 mülkünde nosweatusa.com web akışı bulunamadı.');
 const {data}=await client.request({url:adminURL+property,timeout:15000});
 new Intl.DateTimeFormat('en',{timeZone:data.timeZone}).format(new Date());
 return {property,name:data.displayName||property,timeZone:data.timeZone,measurementId:own.map(s=>s.webStreamData.measurementId).join(', ')};
}
async function discover(client){
 const accounts=await list(client,'accountSummaries','accountSummaries');const candidates=accounts.flatMap(a=>a.propertySummaries||[]);
 if(candidates.length>100)throw new Error('Hesapta çok fazla mülk var. Siteye özel bir hesap kullanın.');
 const properties=[];
 for(const candidate of candidates){
  try{properties.push(await verifyTrafficProperty(client,candidate.property));}catch(error){if(error.message!=='Bu GA4 mülkünde nosweatusa.com web akışı bulunamadı.')throw error;}
 }
 if(!properties.length)throw new Error('Bu hesapta nosweatusa.com GA4 web akışı bulunamadı. Doğru Analytics hesabıyla bağlanın.');
 return properties;
}
export async function prepareTraffic(db,shop){
 if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)throw new Error('Sunucuda Google OAuth ayarları eksik.');
 const ticket=crypto.randomBytes(32).toString('hex');
 await db.trafficOAuth.deleteMany({where:{OR:[{shop},{expiresAt:{lt:new Date()}}]}});
 await db.trafficOAuth.create({data:{shop,ticketHash:hash(ticket),expiresAt:new Date(Date.now()+600000)}});
 return `${appOrigin()}/google/analytics-connect?ticket=${ticket}`;
}
export async function startTraffic(db,ticket){
 if(!/^[a-f0-9]{64}$/.test(ticket||''))throw new Error('Geçersiz bağlantı.');
 const row=await db.trafficOAuth.findUnique({where:{ticketHash:hash(ticket)}});
 if(!row||row.expiresAt<new Date())throw new Error('Bağlantının süresi doldu.');
 const state=crypto.randomBytes(32).toString('hex'),client=oauthClient(),{codeVerifier,codeChallenge}=await client.generateCodeVerifierAsync();
 const used=await db.trafficOAuth.updateMany({where:{id:row.id,ticketHash:hash(ticket),expiresAt:{gt:new Date()}},data:{ticketHash:null,stateHash:hash(state),verifier:seal(codeVerifier,`analytics:${row.shop}`)}});
 if(used.count!==1)throw new Error('Bağlantı zaten kullanıldı.');
 return {url:client.generateAuthUrl({access_type:'offline',scope:[scope],prompt:'consent',state,code_challenge:codeChallenge,code_challenge_method:'S256'}),cookie:`nosweat_analytics_state=${state}; Path=/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`};
}
export async function isTrafficCallback(db,state){return /^[a-f0-9]{64}$/.test(state||'')&&Boolean(await db.trafficOAuth.findUnique({where:{stateHash:hash(state)}}));}
export async function finishTraffic(db,{state,code,cookie,error},factory=oauthClient){
 const browserState=(cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('nosweat_analytics_state='))?.slice('nosweat_analytics_state='.length);
 if(!/^[a-f0-9]{64}$/.test(state||'')||!equal(state,browserState))throw new Error('Analytics bağlantısını başlattığınız tarayıcıyı kullanın.');
 const row=await db.trafficOAuth.findUnique({where:{stateHash:hash(state)}});
 if(!row||row.expiresAt<new Date())throw new Error('Analytics bağlantısının süresi doldu.');
 if((await db.trafficOAuth.deleteMany({where:{id:row.id,stateHash:hash(state)}})).count!==1)throw new Error('Yanıt zaten kullanıldı.');
 if(error||!code)throw new Error('Analytics izni verilmedi.');
 const client=factory();let tokens,properties;
 try{({tokens}=await client.getToken({code,codeVerifier:unseal(row.verifier,`analytics:${row.shop}`)}));if(!tokens.refresh_token||!tokens.scope?.split(' ').includes(scope))throw new Error('scope');client.setCredentials(tokens);properties=await discover(client);}catch(e){throw apiError(e);}
 const selected=properties[0],data={...selected,properties:JSON.stringify(properties),tokens:seal(tokens,`analytics:${row.shop}`),mode:'oauth'};
 await db.$transaction(async tx=>{if(!await tx.seoWorkspace.findUnique({where:{shop:row.shop}}))throw new Error('Uygulama artık bağlı değil.');await tx.trafficConnection.upsert({where:{shop:row.shop},create:{shop:row.shop,...data},update:data});});
}
export async function trafficClient(db,shop){
 const row=await db.trafficConnection.findUnique({where:{shop}});if(!row)throw new Error('Önce Google Analytics hesabını bağlayın.');
 let client;
 if(row.mode==='service'){const c=credentials();if(!c)throw new Error('Google hizmet hesabı ayarı eksik.');client=await new GoogleAuth({credentials:c,scopes:[scope]}).getClient();}
 else{client=oauthClient();client.setCredentials(unseal(row.tokens,`analytics:${shop}`));}
 return {client,row};
}
export async function connectTrafficService(db,shop,propertyId){
 if(!/^\d{1,20}$/.test(propertyId||''))throw new Error('GA4 sayısal mülk kimliğini girin; G- ile başlayan etiket kimliğini değil.');
 const c=credentials();if(!c)throw new Error('Sunucuda Google hizmet hesabı ayarı yok. Google hesabıyla bağlanın.');
 const client=await new GoogleAuth({credentials:c,scopes:[scope]}).getClient();let selected;
 try{selected=await verifyTrafficProperty(client,`properties/${propertyId}`);}catch(e){throw apiError(e);}
 const data={...selected,properties:JSON.stringify([selected]),tokens:'',mode:'service'};
 await db.trafficConnection.upsert({where:{shop},create:{shop,...data},update:data});
}
const hostFilter={filter:{fieldName:'hostName',inListFilter:{values:hosts}}};
export async function fetchTrafficReport(client,property,range,dimensions,metrics,extraFilter=null){
 const rows=[];let metadata={},rowCount=0;
 for(let offset=0;offset<10000;offset+=1000){
  const {data}=await client.request({url:`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,method:'POST',timeout:25000,data:{dateRanges:[{startDate:range.start,endDate:range.end}],dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),dimensionFilter:extraFilter?{andGroup:{expressions:[hostFilter,extraFilter]}}:hostFilter,limit:'1000',offset:String(offset),orderBys:dimensions.includes('date')?[{dimension:{dimensionName:'date'}}]:[{metric:{metricName:metrics[0]},desc:true}],keepEmptyRows:false,returnPropertyQuota:true}});
  metadata=data.metadata||{};rowCount=Number(data.rowCount||0);
  if((data.dimensionHeaders||[]).map(h=>h.name).join('|')!==dimensions.join('|')||(data.metricHeaders||[]).map(h=>h.name).join('|')!==metrics.join('|'))throw new Error('Analytics yanıtındaki alanlar eşleşmedi.');
  for(const r of data.rows||[]){const values=Object.fromEntries(dimensions.map((name,i)=>[name,String(r.dimensionValues?.[i]?.value||'').slice(0,500)]));for(const [i,name]of metrics.entries()){const n=Number(r.metricValues?.[i]?.value);if(!Number.isFinite(n)||n<0)throw new Error('Geçersiz Analytics ölçümü.');values[name]=n;}rows.push(values);}
  if(offset+(data.rows?.length||0)>=rowCount)break;
  if(!data.rows?.length)throw new Error('Analytics sayfalaması tamamlanamadı.');
 }
 return {rows,limited:rows.length<rowCount,thresholded:Boolean(metadata.subjectToThresholding),otherRow:Boolean(metadata.dataLossFromOtherRow),sampled:Boolean(metadata.samplingMetadatas?.length),timeZone:metadata.timeZone||'',rowCount};
}
export async function syncTraffic({db,shop,state,period='week',now=new Date(),context=null}){
 const {client,row}=context||await trafficClient(db,shop);const range=trafficRange(period,row.timeZone,now);
 let results;
 try{
  await client.getAccessToken();
  const requests=[
   [range,[],['sessions','totalUsers','screenPageViews']],
   [{start:range.previousStart,end:range.previousEnd},[],['sessions','totalUsers','screenPageViews']],
   [range,['date'],['sessions','totalUsers','screenPageViews']],
   [range,['sessionSource','sessionMedium','sessionCampaignName','sessionDefaultChannelGroup','country','countryId'],['sessions','totalUsers']],
   [range,['country','countryId'],['sessions','totalUsers']],
   [range,['pagePath','sessionSource','sessionMedium','sessionCampaignName','sessionDefaultChannelGroup','country','countryId'],['screenPageViews'],{filter:{fieldName:'pagePath',stringFilter:{matchType:'PARTIAL_REGEXP',value:'^/(products|product-page)/'}}}],
  ];
  results=[];for(const args of requests)results.push(await fetchTrafficReport(client,row.property,...args));
 }catch(e){throw apiError(e);}
 if(!context){
  const updated=await db.trafficConnection.updateMany({where:{shop,tokens:row.tokens,property:row.property,updatedAt:row.updatedAt},data:row.mode==='oauth'?{tokens:seal(client.credentials,`analytics:${shop}`)}:{property:row.property}});if(!updated.count)throw new Error('Analytics bağlantısı değişti. Yeniden deneyin.');
 }
 const [current,previous,daily,sources,countries,products]=results;
 const label=r=>({...r,label:sourceLabel(r.sessionSource,r.sessionMedium,r.sessionDefaultChannelGroup)});
 const zero={sessions:0,totalUsers:0,screenPageViews:0};
 const report={...range,property:row.property,name:row.name,generatedAt:now.toISOString(),current:current.rows[0]||zero,previous:previous.rows[0]||zero,daily:daily.rows,sources:sources.rows.map(label),countries:countries.rows,products:products.rows.map(r=>({...label(r),...productInfo(r.pagePath,state.catalog?.pages)})),quality:{limited:results.some(r=>r.limited),thresholded:results.some(r=>r.thresholded),otherRow:results.some(r=>r.otherRow),sampled:results.some(r=>r.sampled)}};
 state.traffic||={auto:false,reports:{}};state.traffic.reports=Object.fromEntries(Object.entries(state.traffic.reports||{}).filter(([,r])=>r.property===row.property));state.traffic.reports[period]=report;
 return report;
}

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {trafficRange,sourceLabel,countryFlag,productInfo} from '../app/lib/traffic.mjs';
import {fetchTrafficReport,syncTraffic,verifyTrafficProperty,finishTraffic,startTraffic,prepareTraffic} from '../app/lib/traffic.server.mjs';
import {trafficPDF} from '../app/lib/traffic-export.server.mjs';
import {runDaily} from '../app/lib/daily.server.mjs';
import {testDatabase} from './database-fixture.mjs';
import {ensureWorkspace,performOperation} from '../app/lib/workspace.server.mjs';
import {unseal} from '../app/lib/secrets.server.mjs';

test('calendar ranges follow the property timezone across DST and keep today partial',()=>{
 const r=trafficRange('week','America/Los_Angeles',new Date('2026-03-09T02:00:00Z'));
 assert.equal(r.start,'2026-03-01');assert.equal(r.end,'2026-03-07');assert.equal(r.previousEnd,'2026-02-28');
 assert.equal(trafficRange('today','Asia/Baku',new Date('2026-10-05T21:00:00Z')).start,'2026-10-06');
 assert.equal(trafficRange('today').partial,true);assert.throws(()=>trafficRange('invalid'));
});
test('source classification does not infer paid traffic from social source or spoofed domains',()=>{
 assert.equal(sourceLabel('l.instagram.com','referral','Organic Social'),'Instagram');
 assert.equal(sourceLabel('tiktok','paid_social','Paid Social'),'TikTok · Reklam');
 assert.equal(sourceLabel('instagram.com.evil.test','referral','Referral'),'instagram.com.evil.test');
 assert.equal(sourceLabel('(not set)','','Unassigned'),'Bilinmeyen kaynak');
 assert.match(sourceLabel('(direct)','(none)','Direct'),/^Direct/);assert.equal(countryFlag('US'),'🇺🇸');assert.equal(countryFlag('ZZ'),'🌐');
 assert.equal(productInfo('/products/a?secret=1',[{type:'product',url:'https://nosweatusa.com/products/a',title:'A',images:[{url:'https://cdn.shopify.com/a.jpg'}]}]).title,'A');
});
const response=(dimensions,metrics,rows,metadata={})=>({data:{dimensionHeaders:dimensions.map(name=>({name})),metricHeaders:metrics.map(name=>({name})),rows:rows.map(r=>({dimensionValues:dimensions.map(name=>({value:r[name]||''})),metricValues:metrics.map(name=>({value:String(r[name]??0)}))})),rowCount:rows.length,metadata}});
test('API requests isolate site hosts, paginate, surface quality flags and reject corrupt metrics',async()=>{
 const calls=[];const client={request:async req=>{calls.push(req);const r=response(['country'],['sessions'],[{country:'US',sessions:3}],{subjectToThresholding:true,dataLossFromOtherRow:true});r.data.rowCount=1001;return r;}};
 const report=await fetchTrafficReport(client,'properties/123',{start:'2026-10-01',end:'2026-10-02'},['country'],['sessions']);
 assert.equal(calls.length,2);assert.equal(calls[1].data.offset,'1000');assert.equal(report.thresholded,true);assert.equal(report.otherRow,true);
 assert.deepEqual(calls[0].data.dimensionFilter.filter.inListFilter.values,['nosweatusa.com','www.nosweatusa.com','iyhxfe-mw.myshopify.com']);
 await assert.rejects(()=>fetchTrafficReport({request:async()=>response([],['sessions'],[{sessions:'NaN'}])},'properties/123',{start:'a',end:'b'},[],['sessions']),/Geçersiz/);
});
test('property verification requires the store web stream',async()=>{
 await assert.rejects(()=>verifyTrafficProperty({request:async()=>({data:{dataStreams:[{type:'WEB_DATA_STREAM',webStreamData:{defaultUri:'https://nosweatusa.com.evil.test'}}]}})},'properties/123'),/web akışı/);
 await assert.rejects(()=>verifyTrafficProperty({},'properties/../other'),/Geçerli/);
});
test('sync keeps independently queried users, no fabricated joins, and preserves reports on failure',async()=>{
 const calls=[];const context={row:{property:'properties/123',name:'No Sweat',timeZone:'America/New_York'},client:{getAccessToken:async()=>{},request:async req=>{calls.push(req);const dims=req.data.dimensions.map(d=>d.name),metrics=req.data.metrics.map(d=>d.name);let rows=[];
 if(!dims.length)rows=[{sessions:10,totalUsers:7,screenPageViews:22}];
 else if(dims[0]==='date')rows=[{date:'20260929',sessions:10,totalUsers:7,screenPageViews:22}];
 else if(dims[0]==='sessionSource')rows=[{sessionSource:'tiktok',sessionMedium:'paid_social',sessionCampaignName:'fall',sessionDefaultChannelGroup:'Paid Social',country:'United States',countryId:'US',sessions:6,totalUsers:5},{sessionSource:'(direct)',sessionMedium:'(none)',country:'United States',countryId:'US',sessions:4,totalUsers:5}];
 else if(dims[0]==='country')rows=[{country:'United States',countryId:'US',sessions:10,totalUsers:7}];
 else rows=[{pagePath:'/products/spray',sessionSource:'tiktok',sessionMedium:'paid_social',sessionCampaignName:'fall',sessionDefaultChannelGroup:'Paid Social',country:'United States',countryId:'US',screenPageViews:8}];
 return response(dims,metrics,rows);}}};
 const state={catalog:{pages:[]}};const report=await syncTraffic({state,shop:'test',context,now:new Date('2026-10-05T12:00:00Z')});
 assert.equal(calls.length,6);assert.equal(report.current.totalUsers,7);assert.equal(report.sources.reduce((n,r)=>n+r.totalUsers,0),10);assert.equal(report.products[0].screenPageViews,8);assert.equal(report.products[0].label,'TikTok · Reklam');assert.equal(report.previousStart,'2026-09-21');
 const saved=JSON.stringify(state);context.client.request=async()=>{throw new Error('offline');};await assert.rejects(()=>syncTraffic({state,context}),/Önceki rapor/);assert.equal(JSON.stringify(state),saved);
 const pdf=await trafficPDF(report);assert.ok(pdf.subarray(0,5).equals(Buffer.from('%PDF-')));assert.ok(pdf.length>1000);
});
test('OAuth rejects cross-browser callbacks and consumed connection tickets before token exchange',async()=>{
 await assert.rejects(()=>finishTraffic({}, {state:'a'.repeat(64),code:'secret',cookie:'nosweat_analytics_state='+('b'.repeat(64))}),/tarayıcı/);
 await assert.rejects(()=>startTraffic({},'invalid'),/Geçersiz/);
 const db={trafficOAuth:{findUnique:async()=>({expiresAt:new Date(Date.now()-1000)})}};await assert.rejects(()=>startTraffic(db,'a'.repeat(64)),/süresi/);
});
test('OAuth roundtrip binds browser/shop, encrypts tokens, rejects replay and leaves Search Console intact',async t=>{
 const db=await testDatabase(t),shop='analytics-test.myshopify.com';
 const env={INTEGRATION_ENCRYPTION_KEY:process.env.INTEGRATION_ENCRYPTION_KEY,GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET:process.env.GOOGLE_CLIENT_SECRET,SHOPIFY_APP_URL:process.env.SHOPIFY_APP_URL};
 process.env.INTEGRATION_ENCRYPTION_KEY='ab'.repeat(32);process.env.GOOGLE_CLIENT_ID='test';process.env.GOOGLE_CLIENT_SECRET='test';process.env.SHOPIFY_APP_URL='https://example.com';
 try{
  await ensureWorkspace(db,shop);await db.googleConnection.create({data:{shop,tokens:'existing-search-tokens',properties:'[]'}});
  const ticket=new URL(await prepareTraffic(db,shop)).searchParams.get('ticket');const start=await startTraffic(db,ticket),state=new URL(start.url).searchParams.get('state');
  await assert.rejects(()=>startTraffic(db,ticket));
  const factory=()=>({getToken:async()=>({tokens:{refresh_token:'private-refresh-token',scope:'https://www.googleapis.com/auth/analytics.readonly'}}),setCredentials:()=>{},request:async({url})=>{
   if(url.endsWith('accountSummaries'))return {data:{accountSummaries:[{propertySummaries:[{property:'properties/123'}]}]}};
   if(url.endsWith('/dataStreams'))return {data:{dataStreams:[{type:'WEB_DATA_STREAM',webStreamData:{defaultUri:'https://nosweatusa.com',measurementId:'G-EXAMPLE'}}]}};
   return {data:{displayName:'No Sweat',timeZone:'America/New_York'}};
  }});
  const input={state,code:'one-time-code',cookie:start.cookie};await finishTraffic(db,input,factory);
  const connection=await db.trafficConnection.findUnique({where:{shop}});assert.equal(connection.property,'properties/123');assert(!connection.tokens.includes('private-refresh-token'));assert.equal(unseal(connection.tokens,`analytics:${shop}`).refresh_token,'private-refresh-token');
  assert.equal((await db.googleConnection.findUnique({where:{shop}})).tokens,'existing-search-tokens');await assert.rejects(()=>finishTraffic(db,input,factory));
  await performOperation({db,shop,admin:{graphql:async()=>{}},input:{intent:'traffic-settings',auto:'true'}});assert.equal(JSON.parse((await db.seoWorkspace.findUnique({where:{shop}})).data).traffic.auto,true);
  await performOperation({db,shop,admin:{graphql:async()=>{}},input:{intent:'traffic-disconnect',confirm:'DISCONNECT'}});assert.equal(await db.trafficConnection.count({where:{shop}}),0);
 }finally{for(const[k,v]of Object.entries(env))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('scheduler runs only authorized enabled analytics and propagates failures',async()=>{
 const previous={CRON_SECRET:process.env.CRON_SECRET,ALLOWED_SHOP:process.env.ALLOWED_SHOP};process.env.CRON_SECRET='x'.repeat(32);process.env.ALLOWED_SHOP='test.myshopify.com';
 try{const db={seoWorkspace:{findUnique:async()=>({data:JSON.stringify({traffic:{auto:true}})})},googleConnection:{findUnique:async()=>null}};
 const request=new Request('https://example.com/jobs/daily?task=traffic',{headers:{authorization:'Bearer '+'x'.repeat(32)}});const calls=[];
 const r=await runDaily(request,db,async args=>{calls.push(args.input.intent);return {ok:true,message:'done'};});assert.equal(r.status,200);assert.deepEqual(calls,['traffic-auto']);assert.equal((await runDaily(request,db,async()=>{throw new Error();})).status,503);
 }finally{for(const [k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});

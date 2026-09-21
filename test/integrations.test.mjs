import {testDatabase} from './database-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {seal,unseal,hash,assetURL,validAsset,equal} from '../app/lib/secrets.server.mjs';
import {googleStatus,prepareGoogle,startGoogle,finishGoogle,fetchGoogleReport,dateRange,ownProperty,syncGoogle} from '../app/lib/google.server.mjs';
import {prepareCompression,applyCompression,checkCompression,optimizeImage,compressionList} from '../app/lib/compression.server.mjs';
import {isPublicIPv4,publicURL} from '../app/lib/public-fetch.server.mjs';
import {addBacklink,inspectBacklinks,checkBacklinks} from '../app/lib/backlinks.server.mjs';
process.env.INTEGRATION_ENCRYPTION_KEY='a'.repeat(64);process.env.SHOPIFY_APP_URL='https://app.example.com';process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';
const shop='test.myshopify.com';
async function fixture(t){const db=await testDatabase(t);await db.seoWorkspace.create({data:{shop,data:'{}'}});return db;}
test('encrypted tokens are shop-bound and signed assets reject tampering and expiry',()=>{
 const token=seal({refresh_token:'private'},shop);assert(!token.includes('private'));assert.deepEqual(unseal(token,shop),{refresh_token:'private'});assert.throws(()=>unseal(token,'other.myshopify.com'));assert.equal(equal('é','aa'),false);
 const url=new URL(assetURL('test','optimized')),q=url.searchParams;assert(validAsset('test','optimized',q.get('expires'),q.get('sig')));assert(!validAsset('test','original',q.get('expires'),q.get('sig')));assert(!validAsset('test','optimized','1',q.get('sig')));
});
test('OAuth tickets are one-use, browser-bound and replay-proof; tokens stay out of status',async t=>{
 const db=await fixture(t),link=await prepareGoogle(db,shop),ticket=new URL(link).searchParams.get('ticket');const start=await startGoogle(db,ticket);await assert.rejects(startGoogle(db,ticket));const state=new URL(start.url).searchParams.get('state');assert(new URL(start.url).searchParams.get('code_challenge'));await assert.rejects(finishGoogle(db,{state,code:'test',cookie:'nosweat_google_state=wrong'}),/tarayıcıda/);
 const fake=()=>({getToken:async()=>({tokens:{refresh_token:'refresh-secret',access_token:'access-secret',scope:'https://www.googleapis.com/auth/webmasters.readonly'}}),setCredentials(){},request:async()=>({data:{siteEntry:[{siteUrl:'sc-domain:nosweatusa.com',permissionLevel:'siteOwner'},{siteUrl:'sc-domain:other.com',permissionLevel:'siteOwner'}]}})});
 await finishGoogle(db,{state,code:'test',cookie:start.cookie},fake);await assert.rejects(finishGoogle(db,{state,code:'test',cookie:start.cookie},fake));const status=await googleStatus(db,shop);assert.equal(status.connected,true);assert.deepEqual(status.properties,['sc-domain:nosweatusa.com']);assert(!JSON.stringify(status).includes('secret'));
});
test('OAuth denial consumes state and creates no connection',async t=>{const db=await fixture(t),link=await prepareGoogle(db,shop),start=await startGoogle(db,new URL(link).searchParams.get('ticket'));await assert.rejects(finishGoogle(db,{state:new URL(start.url).searchParams.get('state'),error:'access_denied',cookie:start.cookie}),/izni/);assert.equal(await db.googleConnection.count(),0);assert.equal(await db.googleOAuth.count(),0);});
test('Google API requests paginate and keep page-level weighted metrics',async()=>{
 let calls=0;const client={request:async({data})=>{calls++;assert.equal(data.startRow,calls===1?0:25000);assert.deepEqual(data.dimensions,['page']);return {data:{rows:Array.from({length:calls===1?25000:1},(_,i)=>({keys:[`https://nosweatusa.com/products/${data.startRow+i}`],clicks:1,impressions:10,position:3}))}};}};
 const report=await fetchGoogleReport(client,'sc-domain:nosweatusa.com','2026-08-01','2026-08-28');assert.equal(report.rows.length,25001);assert.equal(report.rows[0].ctr,.1);assert.equal(report.truncated,false);
 assert.deepEqual(dateRange(new Date('2026-09-21T12:00:00Z')),[['2026-08-22','2026-09-18'],['2026-07-25','2026-08-21']]);assert(!ownProperty('https://nosweatusa.com.evil.test/'));
});
test('failed Google refresh leaves existing reports unchanged',async t=>{const db=await fixture(t);await db.googleConnection.create({data:{shop,tokens:seal({refresh_token:'secret'},shop),properties:'["sc-domain:nosweatusa.com"]',property:'sc-domain:nosweatusa.com'}});const state={gsc:[{source:'old'}]};await assert.rejects(syncGoogle(db,shop,state,()=>({setCredentials(){},getAccessToken:async()=>{throw new Error('revoked');}})));assert.deepEqual(state.gsc,[{source:'old'}]);assert.equal((await db.googleConnection.findUnique({where:{shop}})).syncedAt,null);});
test('compression previews save originals, reject stale sources and verify uploaded bytes',async t=>{
 const db=await fixture(t),original=await sharp({create:{width:200,height:200,channels:4,background:{r:30,g:80,b:140,alpha:1}}}).png({compressionLevel:0}).toBuffer();const state={catalog:{pages:[{images:[{id:'image1'}]}]}};let current=original,writes=0;const api={query:async(q)=>q.startsWith('mutation')?(writes++,{fileUpdate:{files:[{id:'image1'}],userErrors:[]}}):{node:{id:'image1',fileStatus:'READY',updatedAt:'2026-09-21',originalSource:{url:'https://cdn.shopify.com/test'}}}};
 await prepareCompression({db,shop,api,state,imageId:'image1',downloader:async()=>current});const row=await db.imageCompression.findFirst();assert(row.optimized.length<original.length);assert.equal(writes,0);const list=await compressionList(db,shop);assert.equal(list[0].beforeBytes,original.length);assert.equal(list[0].original,undefined);assert.equal(hash(Buffer.from(row.original)),hash(original));assert.equal((await sharp(Buffer.from(row.optimized)).metadata()).width,200);
 current=Buffer.from('changed');await assert.rejects(applyCompression({db,shop,api,id:row.id,afterHash:row.afterHash,confirm:'APPLY',downloader:async()=>current}),/değişti/);assert.equal(writes,0);
 current=original;await applyCompression({db,shop,api,id:row.id,afterHash:row.afterHash,confirm:'APPLY',downloader:async()=>current});assert.equal(writes,1);assert.equal((await db.imageCompression.findUnique({where:{id:row.id}})).status,'submitted');
 await checkCompression({db,shop,api,id:row.id,downloader:async()=>current});assert.equal((await db.imageCompression.findUnique({where:{id:row.id}})).status,'submitted');current=Buffer.from(row.optimized);await checkCompression({db,shop,api,id:row.id,downloader:async()=>current});assert.equal((await db.imageCompression.findUnique({where:{id:row.id}})).status,'ready');
 await assert.rejects(optimizeImage(Buffer.from('<svg></svg>')));
});
test('public URL validation denies private ranges and unsafe schemes',()=>{for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','100.64.1.1','0.0.0.0','224.0.0.1'])assert(!isPublicIPv4(ip),ip);assert(isPublicIPv4('8.8.8.8'));for(const url of ['http://example.com','https://user:password@example.com','https://example.com:444','file:///etc/passwd'])assert.throws(()=>publicURL(url));});
test('backlink checker distinguishes unlinked mentions, rel flags and unknown HTTP results',async()=>{
 const result=inspectBacklinks('<p>No Sweat USA</p><a href="https://nosweatusa.com/products/x" rel="nofollow sponsored">Brand</a><a data-href="https://nosweatusa.com">Fake</a><script><a href="https://nosweatusa.com">Fake</a></script>','https://example.com');assert.equal(result.links.length,1);assert.equal(result.links[0].rel,'nofollow sponsored');assert(result.mentioned);
 const state={};addBacklink(state,{url:'https://example.com/article'});await checkBacklinks(state,async()=>({status:200,url:'https://example.com/article',bytes:Buffer.from('<p>No Sweat USA</p>')}));assert.equal(state.backlinks[0].status,'mention');await checkBacklinks(state,async()=>({status:403}));assert.equal(state.backlinks[0].status,'unknown');assert.throws(()=>addBacklink(state,{url:'https://nosweatusa.com/products/x'}));
});

test('Google refresh separates global and USA totals and details for both periods; partial failure preserves reports',async t=>{
 const db=await fixture(t);await db.googleConnection.create({data:{shop,tokens:seal({refresh_token:'secret'},shop),properties:'["sc-domain:nosweatusa.com"]',property:'sc-domain:nosweatusa.com'}});
 const calls=[];let fail=false;
 const factory=()=>({credentials:{refresh_token:'secret'},setCredentials(){},getAccessToken:async()=>{},request:async({data})=>{calls.push(data);if(fail&&calls.length===3)throw new Error('interrupted');if(calls.length<=8)assert.equal(data.dimensionFilterGroups[0].filters[0].expression,'usa');else assert.equal(data.dimensionFilterGroups,undefined);if(!data.dimensions.length)assert.equal(data.aggregationType,'byProperty');return {data:{rows:[{keys:data.dimensions.map(d=>d==='page'?'https://nosweatusa.com/products/example':d==='query'?'example':data.startDate),clicks:1,impressions:100,position:8}]}};}});
 const state={gsc:[{source:'old'}]};await syncGoogle(db,shop,state,factory);assert.equal(calls.length,16);assert.equal(state.growth.reports.length,12);assert.equal(state.gsc.filter(r=>r.country==='all').length,2);assert.equal(state.growth.reports.filter(r=>r.grain==='property'&&!r.truncated).length,4);assert.equal(state.growth.reports[0].rows[0].query,'example');assert.equal(state.growth.reports[1].rows[0].date,calls[2].startDate);assert.equal(state.gsc[0].source,'old');
 const snapshot=structuredClone(state);calls.length=0;fail=true;await assert.rejects(syncGoogle(db,shop,state,factory));assert.deepEqual(state,snapshot);
});

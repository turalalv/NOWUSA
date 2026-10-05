import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {testDatabase} from './database-fixture.mjs';
import {visitorPath,attribution,summarizeVisitors} from '../app/lib/visitors.mjs';
import {collectVisitor,configureVisitors,visitorReport,cleanupVisitors,clientCountry} from '../app/lib/visitors.server.mjs';
import {visitorPixel} from '../app/lib/visitors-pixel.mjs';

process.env.INTEGRATION_ENCRYPTION_KEY='91'.repeat(32);
process.env.ALLOWED_SHOP='iyhxfe-mw.myshopify.com';
process.env.SHOPIFY_APP_URL='https://app.example.com';
const shop=process.env.ALLOWED_SHOP,now=new Date('2026-10-05T16:00:00Z');
const event={consent:true,host:'www.nosweatusa.com',id:'event_page_123456',visit:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',kind:'page_viewed',at:now.toISOString(),path:'/products/spray',source:'instagram',medium:'paid_social',campaign:'autumn',device:'mobile'};
const request=(body,headers={})=>new Request('https://app.example.com/visitors/collect',{method:'POST',headers:{origin:'https://www.nosweatusa.com','user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',...headers},body:JSON.stringify(body)});
test('allowlists public pages and never retains account/query/referrer parameters',()=>{
 for(const path of ['/','/products/spray','/en-us/collections/sprays/products/spray','/blogs/news/story'])assert.equal(visitorPath(path),path);
 for(const path of ['/account','/checkouts/secret','/search?q=name','/products/spray?email=a@b.com','/products/x#secret','/pages/a%40b','https://evil.com/'])assert.equal(visitorPath(path),null);
 assert.equal(attribution({referrer:'https://instagram.com/post?private=value'}).source,'instagram.com');
 assert.equal(attribution({source:'x@private.com',campaign:'person@example.com'}).source,'(direct)');
 assert.equal(attribution({source:'instagram.com.evil.org'}).label,'instagram.com.evil.org');
});
test('collector deduplicates, stores pseudonyms, ignores disabled/foreign/bot and caps input',async t=>{
 const db=await testDatabase(t);await configureVisitors(db,shop,{intent:'visitors-enable'});const config=await db.visitorTracker.findUnique({where:{shop}}),body={...event,key:config.publicKey};
 body.device='android-mobile';const opts={now,country:()=> 'AZ',rate:()=>true};
 assert.equal((await collectVisitor(request(body),db,opts)).status,204);
 assert.equal((await collectVisitor(request(body),db,opts)).status,204);
 assert.equal(await db.visitorEvent.count(),1);
 const stored=await db.visitorEvent.findFirst();assert.notEqual(stored.visit,event.visit);assert.notEqual(stored.id,event.id);assert.equal(stored.country,'AZ');assert.equal(stored.device,'android-mobile');assert.equal(stored.source,'instagram');assert.equal('ip' in stored,false);
 for(const patch of [{consent:false},{host:'evil.com'},{path:'/account'},{kind:'checkout_completed'},{at:'2025-01-01'},{device:'unknown'}])assert.equal((await collectVisitor(request({...body,...patch}),db,opts)).status,400);
 assert.equal((await collectVisitor(request(body,{origin:'https://evil.com'}),db,opts)).status,403);
 assert.equal((await collectVisitor(request({...body,campaign:'x'.repeat(5000)}),db,opts)).status,400);
 assert.equal((await collectVisitor(request({...body,id:'bot_event_123'},{'user-agent':'Googlebot'}),db,opts)).status,204);
 assert.equal((await collectVisitor(request(body),db,{...opts,rate:()=>false})).status,429);
 await configureVisitors(db,shop,{intent:'visitors-pause'});
 await collectVisitor(request({...body,id:'new_disabled_event'}),db,opts);assert.equal(await db.visitorEvent.count(),1);
 const report=await visitorReport(db,shop,'today',now);assert.equal(report.report.visits,1);assert.equal(report.report.recent[0].label,'Instagram · Reklam');
 await db.visitorEvent.updateMany({data:{receivedAt:new Date(now-31*86400000)}});await cleanupVisitors(db,now);assert.equal(await db.visitorEvent.count(),0);
});
test('report separates views/product events, keeps entry attribution and local day boundaries',()=>{
 const base={...event,visit:'v1',country:'US',occurredAt:now};
 const data=summarizeVisitors([base,{...base,kind:'product_viewed'}, {...base,path:'/products/another',occurredAt:new Date(+now+1000)}, {...base,visit:'v2',country:'TR',source:'(direct)',medium:'(none)'}, {...base,visit:'yesterday',occurredAt:new Date('2026-10-05T03:59:00Z')}],{now:new Date(+now+5000),timeZone:'America/New_York'});
 assert.equal(data.visits,2);assert.equal(data.views,3);assert.equal(data.productViews,1);assert.equal(data.active,2);assert.equal(data.products[0].views,1);assert.equal(data.recent[0].pages.length,2);assert.equal(data.countries.length,2);
 const yesterday=summarizeVisitors([{...base,occurredAt:new Date('2026-10-05T03:59:00Z')}],{period:'yesterday',timeZone:'America/New_York',now});assert.equal(yesterday.visits,1);
});
test('country lookup uses managed proxy, supports IPv6 and returns unknown locally',()=>{
 const render=process.env.RENDER,vercel=process.env.VERCEL;delete process.env.RENDER;delete process.env.VERCEL;
 const req=new Request('https://example.com',{headers:{'x-forwarded-for':'8.8.8.8, 10.0.0.1'}});assert.equal(clientCountry(req),'ZZ');
 process.env.RENDER='true';assert.equal(clientCountry(req),'US');assert.equal(clientCountry(new Request('https://example.com',{headers:{'x-forwarded-for':'2001:4860:4860::8888'}})),'US');
 if(render===undefined)delete process.env.RENDER;else process.env.RENDER=render;if(vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=vercel;
});
test('actual generated pixel gates consent, preserves first source and emits sanitized real standard events',async()=>{
 const listeners={},storage=new Map(),sent=[];let privacy;
 const context={URL,crypto:webcrypto,init:{customerPrivacy:{analyticsProcessingAllowed:false}},api:{customerPrivacy:{subscribe:(_,f)=>privacy=f}},analytics:{subscribe:(name,f)=>listeners[name]=f},browser:{sessionStorage:{getItem:async k=>storage.get(k),setItem:async(k,v)=>storage.set(k,v),removeItem:async k=>storage.delete(k)}},fetch:async(url,options)=>sent.push({url,payload:JSON.parse(options.body)})};
 vm.runInNewContext(visitorPixel({endpoint:'https://app.example.com/visitors/collect',publicKey:'aa'.repeat(24)}),context);
 const standard={id:event.id,name:'page_viewed',timestamp:new Date().toISOString(),context:{document:{location:{href:'https://www.nosweatusa.com/products/spray?utm_source=instagram&utm_medium=paid_social&email=private@example.com'},referrer:'https://instagram.com/p/private'},navigator:{userAgent:'iPhone Mobile'}}};
 const flush=()=>new Promise(r=>setTimeout(r,15));
 listeners.page_viewed(standard);await flush();assert.equal(sent.length,0);assert.equal(storage.size,0);
 privacy({customerPrivacy:{analyticsProcessingAllowed:true}});listeners.page_viewed(standard);await flush();assert.equal(sent.length,1);assert.equal(sent[0].payload.path,'/products/spray');assert.equal(sent[0].payload.source,'instagram');assert.equal(sent[0].payload.device,'ios-mobile');assert(!JSON.stringify(sent).includes('private'));
 listeners.product_viewed({...standard,name:'product_viewed',id:'product_event_123',context:{...standard.context,document:{location:{href:'https://www.nosweatusa.com/products/second'},referrer:'https://www.nosweatusa.com/products/spray'}}});await flush();assert.equal(sent[1].payload.visit,sent[0].payload.visit);assert.equal(sent[1].payload.source,'instagram');
 privacy({customerPrivacy:{analyticsProcessingAllowed:false}});listeners.page_viewed(standard);await flush();assert.equal(sent.length,2);assert.equal(storage.size,0);
 privacy({customerPrivacy:{analyticsProcessingAllowed:true}});listeners.page_viewed({...standard,context:{...standard.context,document:{location:{href:'https://www.nosweatusa.com/account/orders/secret'}}}});await flush();assert.equal(sent.length,2);
});

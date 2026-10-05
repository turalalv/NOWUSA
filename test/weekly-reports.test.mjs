import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyWindow, metricChange, attributedLanding, summarizeOrders, buildWeeklyReport, saveWeeklyReport, saveReportSettings} from '../app/lib/weekly-reports.mjs';
import {fetchWeeklySales, generateWeeklyReport, sendWeeklyEmail, deliveryId} from '../app/lib/weekly-reports.server.mjs';
import {fetchWeeklyGoogle} from '../app/lib/weekly-google.server.mjs';
import {reportPDF, reportEmail} from '../app/lib/weekly-report-export.server.mjs';
import {initialWorkspace, ensureWorkspace, performOperation} from '../app/lib/workspace.server.mjs';
import {runDaily} from '../app/lib/daily.server.mjs';
import {testDatabase} from './database-fixture.mjs';
import {seal} from '../app/lib/secrets.server.mjs';

const shop='test.myshopify.com',window={start:'2026-09-21',end:'2026-09-27',previousStart:'2026-09-14',previousEnd:'2026-09-20'};
const visit=(sourceType='SEO',landingPage='https://nosweatusa.com/products/a?utm_source=google')=>({ready:true,lastVisit:{sourceType,landingPage}});
const order=(extra={})=>({id:'one',createdAt:'2026-09-24T12:00:00Z',test:false,cancelledAt:null,displayFinancialStatus:'PAID',currentTotalPriceSet:{shopMoney:{amount:'24.99',currencyCode:'USD'}},customerJourneySummary:visit(),...extra});
const googleReport=(extra={})=>({property:'sc-domain:nosweatusa.com',source:'google-api',country:'all',device:'all',searchType:'web',grain:'property',startDate:window.start,endDate:window.end,importedAt:'2026-10-01T12:00:00Z',truncated:false,rows:[{page:'',clicks:12,impressions:100,position:4}],...extra});
function reportFixture(){return buildWeeklyReport({state:initialWorkspace(shop),reports:[googleReport(),googleReport({startDate:window.previousStart,endDate:window.previousEnd,rows:[{clicks:0,impressions:50,position:8}]})],changes:[],sales:{status:'unavailable',note:'Sipariş verisi yok.',current:null,previous:null},window});}

test('calendar weeks wait for final data and use Pacific dates through DST/year changes',()=>{
 assert.deepEqual(weeklyWindow(new Date('2026-10-05T12:00:00Z')),window);
 assert.equal(weeklyWindow(new Date('2026-10-07T06:00:00Z')).end,'2026-09-27');
 assert.equal(weeklyWindow(new Date('2026-10-07T08:00:00Z')).end,'2026-10-04');
 for(const date of ['2026-03-11T10:00:00Z','2026-11-04T10:00:00Z','2027-01-01T12:00:00Z']){
  const w=weeklyWindow(new Date(date));assert.equal(new Date(w.start).getUTCDay(),1);assert.equal(new Date(w.end).getUTCDay(),0);
  assert.equal(Date.parse(w.end)-Date.parse(w.start),6*86400000);assert.equal(Date.parse(w.start)-Date.parse(w.previousEnd),86400000);
 }
 assert.deepEqual(metricChange(12,0),{absolute:12,percent:null});assert.equal(metricChange(12,null),null);
});

test('attribution requires explicit Shopify SEO; ads, unknown visits and foreign URLs never become SEO',()=>{
 assert.deepEqual(attributedLanding(visit()),{kind:'seo',path:'/products/a'});
 assert.equal(attributedLanding(visit('AD')).kind,'other');
 assert.equal(attributedLanding({ready:true,lastVisit:{source:'Google',sourceType:null}}).kind,'unknown');
 assert.equal(attributedLanding({...visit(),ready:false}).kind,'unknown');
 assert.equal(attributedLanding(visit('SEO','https://nosweatusa.com.evil.test/products/a')).kind,'unknown');
});

test('sales deduplicate, use Pacific order dates, exclude test/cancelled/unpaid and keep currencies apart',()=>{
 const rows=[order(),order(),order({id:'previous',createdAt:'2026-09-21T06:59:00Z'}),order({id:'ad',customerJourneySummary:visit('AD')}),order({id:'unknown',customerJourneySummary:null}),order({id:'test',test:true}),order({id:'cancelled',cancelledAt:'2026-09-25'}),order({id:'pending',displayFinancialStatus:'PENDING'}),order({id:'eur',currentTotalPriceSet:{shopMoney:{amount:'10.50',currencyCode:'EUR'}}})];
 const sales=summarizeOrders(rows,window);
 assert.equal(sales.current.eligible,4);assert.equal(sales.current.attributed,2);assert.equal(sales.current.unknown,1);assert.equal(sales.current.other,1);
 assert.deepEqual(sales.current.amounts,{USD:24.99,EUR:10.5});assert.equal(sales.previous.attributed,1);assert.equal(sales.current.pages[0].path,'/products/a');
 assert(!JSON.stringify(sales).includes('utm_source'));assert(!JSON.stringify(sales).includes('customerJourneySummary'));
});

test('Shopify pagination is bounded and errors never turn into empty successful sales',async()=>{
 let calls=0;const admin={graphql:async(_q,{variables})=>{calls++;assert.match(variables.query,/created_at:>=2026-09-14/);return Response.json({data:{orders:{nodes:[order({id:String(calls)})],pageInfo:{hasNextPage:calls===1,endCursor:String(calls)}}}});}};
 assert.equal((await fetchWeeklySales(admin,window)).current.attributed,2);assert.equal(calls,2);
 await assert.rejects(fetchWeeklySales({graphql:async()=>Response.json({errors:[{message:'denied'}]})},window),/read_orders/);
 let count=0;const capped=await fetchWeeklySales({graphql:async()=>Response.json({data:{orders:{nodes:[order({id:String(++count)})],pageInfo:{hasNextPage:true,endCursor:String(count)}}}})},window);
 assert.equal(capped.limited,true);assert.equal(capped.status,'limited');
});

test('weekly report preserves scopes, missing values and bounded history',()=>{
 const report=reportFixture();assert.equal(report.traffic.all.clicks.absolute,12);assert.equal(report.traffic.all.clicks.percent,null);assert.equal(report.traffic.usa.current,null);
 const state=initialWorkspace(shop);saveWeeklyReport(state,report);saveWeeklyReport(state,{...report,generatedAt:'new'});assert.equal(state.weekly.reports.length,1);
 for(let i=0;i<30;i++)saveWeeklyReport(state,{...report,id:`r${i}`,end:`2026-${String(i).padStart(2,'0')}`});assert.equal(state.weekly.reports.length,26);
 assert.throws(()=>saveReportSettings(state,{email:'true',recipient:'bad\r\nBcc:evil@example.com'}));
});

test('weekly generation preserves interactive reports and old history on Google failure',async t=>{
 const db=await testDatabase(t),state=initialWorkspace(shop);state.googleDays=90;state.gsc=[{old:true}];state.weekly={reports:[reportFixture()]};
 await assert.rejects(generateWeeklyReport({db,shop,state,canReadOrders:false,google:async()=>{throw new Error('offline');}}));assert.equal(state.weekly.reports.length,1);
 const report=await generateWeeklyReport({db,shop,state,canReadOrders:true,now:new Date('2026-10-05T12:00:00Z'),google:async()=>[googleReport()],salesFetcher:async()=>{throw new Error('denied');}});
 assert.equal(report.sales.status,'unavailable');assert.equal(report.sales.current,null);assert.equal(state.googleDays,90);assert.deepEqual(state.gsc,[{old:true}]);
});

test('weekly Google fetch gets property totals, page detail, and daily effect coverage without replacing interactive selection',async t=>{
 const db=await testDatabase(t);process.env.INTEGRATION_ENCRYPTION_KEY='a'.repeat(64);
 await db.googleConnection.create({data:{shop,tokens:seal({refresh_token:'fake'},shop),properties:'["sc-domain:nosweatusa.com"]',property:'sc-domain:nosweatusa.com'}});
 const calls=[];const factory=()=>({credentials:{refresh_token:'fake'},setCredentials(){},getAccessToken:async()=>{},request:async({data})=>{calls.push(data);return {data:{rows:[]}};}});
 const reports=await fetchWeeklyGoogle(db,shop,window,factory);assert.equal(calls.length,9);assert.equal(reports.filter(r=>r.grain==='property').length,4);
 assert.equal(reports.at(-1).startDate,'2026-08-17');assert.equal(reports.at(-1).country,'usa');assert(reports.every(r=>!r.truncated));
 assert.equal((await db.googleConnection.findUnique({where:{shop}})).syncedAt,null);
});

test('PDF embeds Turkish text and email escapes merchant-controlled text',async()=>{
 const report=reportFixture();report.changes=[{id:'1',date:'2026-09-24',pageTitle:'Türkçe: Şişe ölçüsü <img src=x onerror=alert(1)>'}];
 const pdf=await reportPDF(report);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert(pdf.length>10000);
 const html=reportEmail({...report,property:'<script>alert(1)</script>'});assert(!html.includes('<script>'));assert(html.includes('Haftalık'));
});

test('email is sent once per week/recipient and timeout reservations prevent blind retries',async t=>{
 const db=await testDatabase(t);process.env.RESEND_API_KEY='fake';process.env.REPORT_EMAIL_FROM='report@example.com';
 let sent=0;const args={db,shop,report:reportFixture(),recipient:'owner@example.com',pdfFactory:async()=>Buffer.from('%PDF-test'),fetcher:async(_url,options)=>{sent++;const body=JSON.parse(options.body);assert.equal(body.to[0],'owner@example.com');assert.equal(body.attachments.length,1);assert(options.headers['Idempotency-Key']);return Response.json({id:'provider-id'});}};
 await sendWeeklyEmail(args);await sendWeeklyEmail(args);assert.equal(sent,1);
 const broken={...args,recipient:'second@example.com',fetcher:async()=>{sent++;throw new Error('network');}};
 await assert.rejects(sendWeeklyEmail(broken));await assert.rejects(sendWeeklyEmail(broken),/belirsiz/);assert.equal(sent,2);
 assert.equal((await db.seoReportDelivery.findUnique({where:{id:deliveryId(shop,args.report.id,broken.recipient)}})).status,'unknown');
});

test('scheduler includes opted-in weekly reporting and keeps report generation separate from delivery',async t=>{
 const db=await testDatabase(t);process.env.CRON_SECRET='c'.repeat(32);process.env.ALLOWED_SHOP=shop;
 await ensureWorkspace(db,shop);const state=initialWorkspace(shop);state.weekly={settings:{auto:true,email:true,recipient:'owner@example.com'},reports:[]};await db.seoWorkspace.update({where:{shop},data:{data:JSON.stringify(state)}});
 const calls=[];const run=async args=>{calls.push(args);return {ok:true,message:'done'};};
 const request=new Request('https://app.example/jobs/daily?task=weekly',{headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}});
 await runDaily(request,db,run,async()=>({admin:{graphql(){}},session:{scope:'read_products,read_orders'}}));
 assert.deepEqual(calls.map(c=>c.input.intent),['weekly-auto','weekly-email-auto']);assert.equal(calls[0].canReadOrders,true);
 await assert.rejects(performOperation({db,shop,admin:{},input:{intent:'weekly-email',reportId:'unknown'}}),/onaylayın/);
});

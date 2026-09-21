import test from 'node:test';
import assert from 'node:assert/strict';
import {growthData,changeEffects,setReadiness,saveOutreach,setTaskDone,pacificDate} from '../app/lib/growth.mjs';
const url='https://nosweatusa.com/products/example';
const row={page:url,clicks:10,impressions:1000,position:8};
const report=(grain='page',rows=[row])=>({source:'google-api',country:'usa',device:'all',searchType:'web',property:'sc-domain:nosweatusa.com',grain,startDate:'2026-09-01',endDate:'2026-09-28',importedAt:'2026-09-30T00:00:00Z',rows});
const fixture=()=>({catalog:{pages:[{id:'p1',type:'product',status:'ACTIVE',title:'Example',url,seo:{title:'',description:''},descriptionHtml:'<p>Example</p>',images:[]}]},mappings:{},gsc:[report()],growth:{reports:[]},backlinks:[{id:'b1',url:'https://example.org/article',status:'mention'}]});
test('USA opportunities require real scoped reports and eligible products',()=>{
 const s=fixture();assert.equal(growthData(s).opportunities.length,1);
 s.gsc[0].country='all';assert.equal(growthData(s).current,null);
 s.gsc[0].country='usa';s.gsc[0].source='csv';assert.equal(growthData(s).current,null);
 s.gsc[0].source='google-api';s.catalog.pages[0].status='DRAFT';assert.equal(growthData(s).opportunities.length,0);
});
test('query aliases aggregate counts and weight position without duplicating product count',()=>{
 const s=fixture();s.growth.reports=[report('page-query',[{...row,query:'example'},{...row,page:url+'/',query:'example',impressions:3000,clicks:30,position:4}])];
 const q=growthData(s).queries[0];assert.equal(q.impressions,4000);assert.equal(q.position,5);assert.equal(q.pageCount,1);
 s.growth.reports[0].property='another';assert.equal(growthData(s).queries.length,0);
});
test('readiness keeps unknown checks explicit and rejects automatic or foreign changes',()=>{
 const s=fixture();assert.equal(growthData(s).products[0].checks.find(c=>c.key==='shipping').status,'unknown');
 setReadiness(s,{pageId:'p1',check:'shipping',status:'yes'});assert.equal(growthData(s).products[0].checks.find(c=>c.key==='shipping').status,'yes');
 assert.throws(()=>setReadiness(s,{pageId:'p1',check:'photos',status:'yes'}));
 assert.throws(()=>setReadiness(s,{pageId:'foreign',check:'shipping',status:'yes'}));
});
test('weekly tasks can be completed and reopened, with one selected task per product',()=>{
 const s=fixture();const d=growthData(s);assert.equal(new Set(d.tasks.filter(t=>t.pageId).map(t=>t.pageId)).size,d.tasks.filter(t=>t.pageId).length);
 const taskId=d.tasks[0].id;setTaskDone(s,{taskId,done:'true'});assert(growthData(s).completed.some(t=>t.id===taskId));
 setTaskDone(s,{taskId,done:'false'});assert(!growthData(s).completed.some(t=>t.id===taskId));assert.throws(()=>setTaskDone(s,{taskId:'fake',done:'true'}));
});
test('outreach only drafts for tracked sources and valid catalog targets',()=>{
 const s=fixture();saveOutreach(s,{backlinkId:'b1',pageId:'p1'});assert.match(s.growth.outreach.b1.body,/mentions No Sweat USA/);
 s.backlinks[0].status='unknown';saveOutreach(s,{backlinkId:'b1',pageId:'p1'});assert.doesNotMatch(s.growth.outreach.b1.body,/mentions No Sweat USA/);
 assert.throws(()=>saveOutreach(s,{backlinkId:'other',pageId:'p1'}));
});
test('change windows use Pacific days, exclude change day, and avoid false attribution',()=>{
 assert.equal(pacificDate('2026-09-15T02:00:00Z'),'2026-09-14');
 const s=fixture(),change={id:'c1',pageId:'p1',pageTitle:'Example',createdAt:'2026-09-15T20:00:00Z',status:'applied'};
 s.growth.reports=[report('page-date',[{...row,date:'2026-09-14'},{...row,date:'2026-09-16',clicks:20},{...row,date:'2026-09-15',clicks:500}])];
 const effect=()=>changeEffects(s,[change])[0];assert.equal(effect().clickDifference,10);assert.equal(effect().status,'available');
 assert.equal(changeEffects(s,[change,{...change,id:'c2'}])[0].status,'overlap');
 s.growth.reports[0].truncated=true;assert.equal(effect().status,'limited');
 s.growth.reports[0].truncated=false;s.growth.reports[0].rows=[{...row,date:'2026-09-14'}];assert.equal(effect().after,null);assert.equal(effect().status,'limited');
 s.growth.reports[0].endDate='2026-09-16';assert.equal(effect().status,'waiting');
});

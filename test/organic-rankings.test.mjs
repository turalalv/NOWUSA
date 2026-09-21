import test from 'node:test';
import assert from 'node:assert/strict';
import {suiteState,importSuiteCSV} from '../app/lib/seo-suite.mjs';
import {organicRankings,organicCSV,saveOrganicReport} from '../app/lib/organic-rankings.mjs';
import {fetchSuiteProvider} from '../app/lib/seo-provider.server.mjs';
import {suiteOperation,suiteData} from '../app/lib/seo-suite.server.mjs';

const csv=(date,body,provider='CSV provider')=>({kind:'organic',csv:`keyword,position,url,volume,difficulty\n${body}`,date,provider});
test('organic discovery needs neither tracked keywords nor competitors and excludes non-organic and foreign results',async()=>{
 let payload;
 const item=(keyword,url,position,type='organic')=>({keyword_data:{keyword,keyword_info:{search_volume:null}},ranked_serp_element:{serp_item:{type,url,rank_group:position},last_updated_time:'2026-01-01'}});
 const result=await fetchSuiteProvider(suiteState({}),'organic',async(path,input)=>{assert.match(path,/ranked_keywords/);payload=input;return {total_count:1400,items:[item('a','https://nosweatusa.com/a',8),item('a','https://nosweatusa.com/b',3),item('b','https://evil.test/',1),item('c','https://nosweatusa.com/',1,'paid')]};});
 assert.equal(payload.target,'nosweatusa.com');assert.equal(payload.location_code,2840);assert.equal(payload.limit,1000);
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].position,3);assert.equal(result.rows[0].volume,null);assert(result.limited);
});
test('organic CSV is atomic and comparison uses matching source and prior dates',()=>{
 const state={},suite=suiteState(state);
 importSuiteCSV(state,csv('2026-01-01','a,12,https://nosweatusa.com/a,,0\nmissing,4,https://nosweatusa.com/m,20,2'));
 importSuiteCSV(state,csv('2026-01-03','a,9,https://nosweatusa.com/a,40,10','Other'));
 importSuiteCSV(state,csv('2026-01-04','a,5,https://nosweatusa.com/a,,0\nnew,8,https://nosweatusa.com/new,40,10'));
  const data=organicRankings(suite);assert.equal(data.rows[0].change,7);assert.equal(data.rows[1].change,null);assert.equal(data.previousDate,'2026-01-01');assert.equal(data.rows.length,2);assert.equal(data.rows[0].volume,null);assert.match(organicCSV(suite),/"keyword","position","previous"/);
 assert.match(organicCSV(suiteData(state)),/"a","5","12","7"/);
 const before=structuredClone(suite);assert.throws(()=>importSuiteCSV(state,csv('2026-01-05','a,2,https://nosweatusa.com.evil.test/,2,4')));assert.deepEqual(suite,before);
 assert.throws(()=>importSuiteCSV(state,csv('2026-01-05','a,0,https://nosweatusa.com/,2,4')));
});

test('Semrush English CSV headings map without treating SERP features as organic ranks',()=>{
 const state={};
 importSuiteCSV(state,{kind:'organic',date:'2026-01-01',provider:'Semrush CSV',csv:'Keyword,Position,URL,Search Volume,Keyword Difficulty,CPC,Traffic,Position Type\na,3,https://nosweatusa.com/,400,12,0.5,40,Organic'});
 const row=organicRankings(suiteState(state)).rows[0];assert.equal(row.volume,400);assert.equal(row.difficulty,12);assert.equal(row.cpc,0.5);assert.equal(row.traffic,40);
 assert.throws(()=>importSuiteCSV(state,{kind:'organic',date:'2026-01-01',provider:'Semrush CSV',csv:'Keyword,Position,URL,Position Type\na,1,https://nosweatusa.com/,Featured snippet'}));
});
test('organic provider failures preserve history and successful empty reports are valid',async()=>{
 const state={},suite=suiteState(state);importSuiteCSV(state,csv('2026-01-01','a,2,https://nosweatusa.com/,2,4'));
 await assert.rejects(suiteOperation(state,{intent:'suite-provider',kind:'organic'},{provider:async()=>{throw new Error('quota');}}));assert.equal(suite.organicReports.length,1);
 await assert.rejects(fetchSuiteProvider(suite,'organic',async()=>({total_count:4,items:null})));
 const empty=await fetchSuiteProvider(suite,'organic',async()=>({total_count:0,items:null}));assert.deepEqual(empty.rows,[]);assert.equal(empty.limited,false);
 await suiteOperation(state,{intent:'suite-provider',kind:'organic'},{provider:async()=>empty});assert.equal(organicRankings(suite).rows.length,0);
});

test('summary estimates require complete data, page groups and explicit change states remain distinct',()=>{
 const suite=suiteState({});
 const meta={provider:'Provider',country:'us',language:'en',device:'desktop',observedAt:'2026-01-01',importedAt:'2026-01-01'};
 saveOrganicReport(suite,{...meta,rows:[{keyword:'a',position:9,url:'https://nosweatusa.com/a',traffic:4},{keyword:'b',position:10,url:'https://nosweatusa.com/a',traffic:null}]});
 saveOrganicReport(suite,{...meta,observedAt:'2026-01-02',rows:[{keyword:'a',position:3,url:'https://nosweatusa.com/a',traffic:7},{keyword:'c',position:5,url:'https://nosweatusa.com/a',traffic:null,isNew:true}],lostRows:[{keyword:'b',position:null,url:'https://nosweatusa.com/a'}]});
 const data=organicRankings(suite);assert.equal(data.traffic,null);assert.equal(data.pages[0].keywords,2);assert.equal(data.pages[0].position,3);assert.equal(data.pages[0].traffic,null);assert.equal(data.rows[0].status,'up');assert.equal(data.rows[1].status,'new');assert.equal(data.lostRows[0].previous,10);assert.equal(data.lostRows[0].status,'lost');assert.equal(data.history.length,2);assert.deepEqual(data.previousSummary,{keywords:2,traffic:null,trafficCost:null,top10:2});assert.deepEqual(data.history[0].distribution,[0,2,0,0,0]);assert.deepEqual(data.history[1].distribution,[1,1,0,0,0]);
});

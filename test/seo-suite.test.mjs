import test from 'node:test';
import assert from 'node:assert/strict';
import {suiteState,suiteSettings,importSuiteCSV,keywordGap,rankChanges} from '../app/lib/seo-suite.mjs';
import {suiteOperation,generateDigest} from '../app/lib/seo-suite.server.mjs';
import {fetchSuiteProvider,providerRequest} from '../app/lib/seo-provider.server.mjs';
const date=new Date().toISOString().slice(0,10);
const input=(kind,csv,extra={})=>({kind,csv,date,provider:'Test provider',...extra});
test('imports are atomic, scoped and preserve unknown metrics',()=>{
 const state={};suiteSettings(state,{keywords:'a\na',competitors:'rival.com'});const s=suiteState(state);assert.equal(s.settings.keywords.length,1);
 importSuiteCSV(state,input('keywords','keyword,volume,difficulty\na,,0'));assert.equal(s.keywords.rows[0].volume,null);assert.equal(s.keywords.rows[0].difficulty,0);
 const before=structuredClone(s);assert.throws(()=>importSuiteCSV(state,input('keywords','keyword,volume,difficulty\na,2,101')));assert.deepEqual(s,before);
 assert.throws(()=>importSuiteCSV(state,input('ranks','keyword,device,position,url\na,mobile,3,https://evil.test/')));
 importSuiteCSV(state,input('gaps','keyword,position\na,20',{domain:'nosweatusa.com'}));importSuiteCSV(state,input('gaps','keyword,position\na,2\nb,1',{domain:'rival.com'}));assert.equal(keywordGap(s).length,2);s.domainReports['rival.com'].provider='Other';assert.equal(keywordGap(s).length,0);
 assert.throws(()=>importSuiteCSV(state,input('backlinks','source_url,target_url,status\nhttps://x.test,https://nosweatusa.com/,absent')));
});
test('rank comparison never conflates mobile and desktop or unknown positions',()=>{
 const s=suiteState({});s.ranks=[{provider:'a',country:'us',language:'en',observedAt:'2026-01-01',rows:[{keyword:'a',device:'mobile',position:2},{keyword:'a',device:'desktop',position:10}]},{provider:'a',country:'us',language:'en',observedAt:'2026-01-02',rows:[{keyword:'a',device:'mobile',position:8},{keyword:'a',device:'desktop',position:null}]}];assert.equal(rankChanges(s)[0].change,-6);assert.equal(rankChanges(s)[1].change,null);
});
test('provider sync preserves last successful data on error; lost backlinks are explicit',async()=>{
 const state={catalog:{pages:[]}},s=suiteState(state);s.keywords={rows:[{keyword:'old'}]};await assert.rejects(suiteOperation(state,{intent:'suite-provider',kind:'keywords'},{provider:async()=>{throw new Error('no quota');}}));assert.equal(s.keywords.rows[0].keyword,'old');
 const result=await fetchSuiteProvider(s,'backlinks',async()=>({total_count:2000,items:[{url_from:'https://rival.com/post',url_to:'https://nosweatusa.com/',is_lost:true},{url_from:'javascript:bad',url_to:'https://nosweatusa.com/'}]}));assert.equal(result.rows.length,1);assert.equal(result.rows[0].status,'lost');assert(result.limited);
});
test('SERP adapter has separate device requests and cannot match a lookalike domain',async()=>{
 const s=suiteState({});s.settings.keywords=['a'];const calls=[];const r=await fetchSuiteProvider(s,'ranks',async(path,payload)=>{calls.push(payload);return {items:[{type:'organic',url:'https://nosweatusa.com.evil.test/',rank_group:1},{type:'organic',url:'https://www.nosweatusa.com/products/a',rank_group:8}]};});assert.deepEqual(calls.map(c=>c.device),['desktop','mobile']);assert(r.rows.every(r=>r.position===8));
});
test('provider transport rejects HTTP-200 task errors without exposing secrets',async()=>{
 const old=[process.env.DATAFORSEO_LOGIN,process.env.DATAFORSEO_PASSWORD];process.env.DATAFORSEO_LOGIN='test';process.env.DATAFORSEO_PASSWORD='secret';try{await assert.rejects(providerRequest('backlinks/backlinks/live',{},async()=>new Response(JSON.stringify({status_code:20000,tasks:[{status_code:40200,status_message:'secret'}]}))),e=>!e.message.includes('secret'));}finally{for(const [i,key] of ['DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD'].entries())if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}
});
test('alerts deduplicate and daily runs avoid repetition',async()=>{
 const state={catalog:{pages:[]}},s=suiteState(state);s.settings.auto=true;let calls=0;const audit=async()=>{calls++;return {checkedAt:new Date().toISOString(),pages:[{}],findings:[{type:'Kırık sayfa',url:'https://nosweatusa.com/products/a',detail:'404'}]};};await suiteOperation(state,{intent:'suite-daily'},{audit});generateDigest(state);await suiteOperation(state,{intent:'suite-daily'},{audit});assert.equal(calls,1);assert.equal(s.alerts.length,1);assert.equal(s.digests.length,1);
});

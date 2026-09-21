import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importBacklinkCSV,backlinkComparison} from '../app/lib/backlink-import.mjs';
import {encodeCSV} from '../app/lib/core/csv.mjs';
const csv=(target,source='https://publisher.example/review')=>`source_url,target_url,anchor,rel,nofollow\n${source},https://${target}/product,"sweat, control",sponsored,true`;
test('CSV BOM, aliases, quoted anchor and exact duplicates',()=>{
 const state={};const text='\uFEFFReferring page URL,Target URL,Anchor,NoFollow\r\nhttps://news.example/a,https://sweatblock.com/a,"sweat, control",false';
 const result=importBacklinkCSV(state,{domain:'sweatblock.com',csv:text+'\r\n'+text.split('\r\n')[1]});
 assert.equal(result.links.length,1);assert.equal(result.duplicates,1);assert.equal(result.links[0].anchor,'sweat, control');assert.equal(result.links[0].nofollow,false);assert.equal(result.links[0].status,'imported_unverified');
});
test('comparison distinguishes missing own import from absence in provided data',()=>{
 const state={};for(const domain of ['sweatblock.com','certaindri.com'])importBacklinkCSV(state,{domain,csv:csv(domain)});
 let result=backlinkComparison(state);assert.equal(result.hasOwnReport,false);assert.equal(result.opportunities[0].domains.length,2);
 importBacklinkCSV(state,{domain:'nosweatusa.com',csv:csv('nosweatusa.com')});result=backlinkComparison(state);assert.equal(result.hasOwnReport,true);assert.equal(result.opportunities[0].inOwnImport,true);
 importBacklinkCSV(state,{domain:'nosweatusa.com',csv:csv('nosweatusa.com','https://other.example/a')});assert.equal(backlinkComparison(state).opportunities[0].inOwnImport,false);
});
test('invalid rows, domains, URLs and flags do not partially save',()=>{
 const state={};importBacklinkCSV(state,{domain:'sweatblock.com',csv:csv('sweatblock.com')});const before=JSON.stringify(state);
 for(const bad of [csv('certaindri.com'),csv('sweatblock.com','javascript:alert(1)'),csv('sweatblock.com','https://sweatblock.com/a'),csv('sweatblock.com').replace(',true',',perhaps'),'source_url,target_url\nhttps://news.example/a,broken',csv('sweatblock.com')+'\nhttps://publisher.example/b,https://wrong.example/a,,,']){
 assert.throws(()=>importBacklinkCSV(state,{domain:'sweatblock.com',csv:bad}));assert.equal(JSON.stringify(state),before);
 }
});
test('unknown nofollow is not invented and exported cells are formula safe',()=>{
 const state={};const result=importBacklinkCSV(state,{domain:'sweatblock.com',csv:'source_url,target_url,anchor\nhttps://news.example/a,https://sweatblock.com/a,=1+1'});
 assert.equal(result.links[0].nofollow,null);assert.match(encodeCSV([[result.links[0].anchor]]),/'=1\+1/);
});

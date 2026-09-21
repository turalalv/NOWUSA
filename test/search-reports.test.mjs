import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSearchReports,searchMetrics} from '../app/lib/search-reports.mjs';
const report=(extra={})=>({property:'sc-domain:example.com',country:'all',grain:'property',startDate:'2026-08-01',endDate:'2026-08-28',importedAt:'2026-09-01',rows:[{clicks:10,impressions:200,position:8}],...extra});
test('scope selection cannot mix country, property, periods or page totals',()=>{
 const rows=[report(),report({country:'usa',rows:[{clicks:2,impressions:50,position:4}]}),report({property:'sc-domain:other.com'}),report({grain:'page',rows:[{clicks:12,impressions:240,position:9}]}),report({startDate:'2026-07-04',endDate:'2026-07-31'})];
 const global=selectSearchReports(rows,'sc-domain:example.com','all');assert.equal(searchMetrics(global.total).clicks,10);assert.equal(searchMetrics(global.pages).clicks,12);
 assert.equal(searchMetrics(selectSearchReports(rows,'sc-domain:example.com','usa').total).clicks,2);
 assert.equal(selectSearchReports(rows,'sc-domain:example.com','all','previous').total.startDate,'2026-07-04');
 assert.equal(selectSearchReports(rows,'sc-domain:missing.com').total,null);
 assert.equal(searchMetrics(null),null);assert.deepEqual(searchMetrics(report({rows:[]})),{clicks:0,impressions:0,ctr:0,position:null});
});

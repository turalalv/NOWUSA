import test from 'node:test';
import assert from 'node:assert/strict';
import {storefrontURL,fetchPage,technicalAudit} from '../app/lib/technical.server.mjs';
import {importGSC} from '../app/lib/core/gsc.mjs';
test('crawler rejects external hosts, private endpoints and unsafe redirects',async()=>{
 for(const url of ['http://nosweatusa.com/products/a','https://127.0.0.1/products/a','https://nosweatusa.com/admin','https://nosweatusa.com:444/products/a','https://user@nosweatusa.com/products/a'])assert.equal(storefrontURL(url),null);
 let calls=0;await assert.rejects(fetchPage('https://nosweatusa.com/products/a',{fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://evil.test'}})}}));assert.equal(calls,1);
});
test('audit distinguishes broken links from rate limiting and reports JSON-LD syntax',async()=>{
 const fetcher=async url=>{
  if(url.endsWith('/products/a'))return new Response('<h1>A</h1><script type="application/ld+json">broken</script><a href="/products/missing">Missing</a><a href="/pages/limited">Limited</a>');
  if(url.endsWith('/products/missing'))return new Response('',{status:404});
  if(url.endsWith('/pages/limited'))return new Response('',{status:429});
  return new Response(url.endsWith('robots.txt')?'User-agent: *':'<sitemapindex/>');
 };
 const report=await technicalAudit([{id:'a',title:'A',url:'https://nosweatusa.com/products/a'}],fetcher);
 assert.equal(report.pages[0].technical.invalidSchema,1);
 assert.equal(report.links.filter(l=>l.broken).length,1);assert(report.infrastructure.every(i=>i.valid));
});
test('GSC rejects impossible calendar dates',()=>{assert.throws(()=>importGSC('Top queries,Clicks,Impressions,Position\ncat,1,2,3',{startDate:'2026-02-30',endDate:'2026-03-07',property:'sc-domain:nosweatusa.com'}));});

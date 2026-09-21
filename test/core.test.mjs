import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, catalogFromCSV, encodeCSV } from '../app/lib/core/csv.mjs';
import { audit, suggestion, internalLinks } from '../app/lib/core/seo.mjs';
import { importGSC, summarizeGSC } from '../app/lib/core/gsc.mjs';
import { inspectHTML, Shopify, storeHost } from '../app/lib/core/shopify.mjs';

test('CSV quoted multiline fields, escaped quotes, BOM and trailing variant rows', () => {
  const csv = '\uFEFFHandle,Title,Body (HTML),SEO Title,SEO Description,Image Src,Image Alt Text\r\nx,"A, product","<p>A \"\"quote\"\"\nnext line</p>",Great product,Description,https://cdn.test/a.jpg,Front\r\nx,,,,,https://cdn.test/b.jpg,Back\r\n';
  assert.equal(parseCSV(csv)[0].Title, 'A, product');
  const pages = catalogFromCSV(csv, 'https://nosweatusa.com');
  assert.equal(pages.length,1); assert.equal(pages[0].images.length,2);
  assert.match(pages[0].descriptionHtml, /"quote"\nnext/);
  assert.equal(pages[0].seo.title,'Great product');
  assert.throws(()=>parseCSV('a,b\n"never closes,x'));
});
test('CSV export cannot introduce formulas',()=>{assert.match(encodeCSV([['=IMPORTXML("url")','+SUM(A1)', '@x', 'plain']]),/"'=IMPORTXML/);});
test('missing meta and duplicate effective titles are audited; unavailable metadata is not fabricated',()=>{
  const base={id:'1',title:'Good product title here',descriptionHtml:'<p>Product detail</p>',seo:{title:'',description:''},images:[]};
  const pages=audit([base,{...base,id:'2'}]);
  assert(pages[0].issues.some(i=>i.code==='title_duplicate'));
  assert(pages[0].issues.some(i=>i.code==='meta_missing'));
  const unknown=audit([{...base,source:'public',metaVerified:false,images:[{altText:'',altKnown:false}]}])[0];
  assert(!unknown.issues.some(i=>i.code==='meta_missing'||i.code==='alt_missing'));
  assert(unknown.issues.some(i=>i.code==='meta_unknown'));
});
test('suggestions preserve factual source and do not invent an empty description',()=>{
  const s=suggestion({title:'Skin product',descriptionHtml:'<p>Actual supplied words.</p>'},'Brand');
  assert.equal(s.description,'Actual supplied words.');
  assert.equal(suggestion({title:'Item',descriptionHtml:''}).description,'');
});
test('link suggestions omit existing links, self links and unrelated products',()=>{
  const a={id:'a',title:'Cat litter carbon',handle:'a',url:'https://nosweatusa.com/products/a',descriptionHtml:'<a href="/products/b">B</a>'};
  const b={id:'b',title:'Cat litter refill',type:'product',handle:'b',url:'https://nosweatusa.com/products/b'};
  const c={id:'c',title:'Face gel',handle:'c',url:'https://nosweatusa.com/products/c'};
  const links=internalLinks([a,b,c]); assert(!links.some(l=>l.fromId==='a')); assert(!links.some(l=>l.toId==='c'));
});
const params={startDate:'2026-09-01',endDate:'2026-09-07',property:'sc-domain:nosweatusa.com'};
test('GSC aggregates impressions-weighted position and recomputes CTR',()=>{
  const r=importGSC('Top pages,Clicks,Impressions,CTR,Position\nhttps://nosweatusa.com/a,10,100,999%,5\nhttps://nosweatusa.com/b,2,900,999%,10',params);
  const s=summarizeGSC(r);
  assert.equal(s.totals.clicks,12);assert.equal(s.totals.ctr,.012);assert.equal(s.totals.position,9.5);assert.equal(s.opportunities.length,1);
});
test('GSC rejects duplicate grain, malformed numbers, invalid ranges and incompatible comparisons',()=>{
  const csv='Top pages,Clicks,Impressions,Position\nhttps://nosweatusa.com/a,10,100,5';
  assert.throws(()=>importGSC(csv+'\nhttps://nosweatusa.com/a,1,100,2',params));
  assert.throws(()=>importGSC(csv.replace(',10,',',not-a-number,'),params));
  assert.throws(()=>importGSC(csv,{...params,endDate:'2026-08-01'}));
  const current=importGSC(csv,params), previous=importGSC(csv,{...params,startDate:'2026-08-25',endDate:'2026-08-31'});
  assert(summarizeGSC(current,previous).comparison);
  assert.equal(summarizeGSC(current,{...previous,grain:'query'}).comparison,null);
  assert.equal(summarizeGSC(current,current).comparison,null);
});
test('HTML audit excludes script/template headings and parses JSON-LD graph',()=>{
  const html='<title>Real &amp; title</title><meta content="A description" name="description"><link href="https://nosweatusa.com/a" rel="canonical"><h1>Product</h1><script>const x="<h1>template</h1>"</script><template><h1>Hidden</h1></template><script type="application/ld+json">{"@graph":[{"@type":"Product"}]}</script>';
  const result=inspectHTML(html);assert.equal(result.h1Count,1);assert.equal(result.title,'Real & title');assert.equal(result.description,'A description');assert(result.schemaTypes.includes('Product'));
});
test('Shopify host validation prevents token exfiltration',()=>{
  assert.equal(storeHost('https://test-shop.myshopify.com/'),'test-shop.myshopify.com');
  for(const host of ['localhost','127.0.0.1','test.myshopify.com.evil.test','test.myshopify.com@evil.test','test.myshopify.com:444','http://test.myshopify.com'])assert.throws(()=>storeHost(host));
});
test('Shopify pagination and scoped product/collection mutation shapes',async()=>{
  const api=new Shopify({SHOPIFY_STORE:'test.myshopify.com',SHOPIFY_ACCESS_TOKEN:'test'});const calls=[];
  api.query=async(q,v)=>{
    calls.push({q,v});
    if(q.includes('shop {'))return {shop:{name:'Shop',myshopifyDomain:'test.myshopify.com',primaryDomain:{url:'https://nosweatusa.com'}}};
    if(q.includes('products(first:'))return {products:{nodes:[{id:v.after?'p2':'p1',title:'Product',images:{nodes:[]},seo:{}}],pageInfo:{hasNextPage:!v.after,endCursor:'next'}}};
    if(q.includes('collections(first:'))return {collections:{nodes:[{id:'c1',title:'Collection'}],pageInfo:{hasNextPage:false}}};
    if(q.includes('productUpdate'))return {productUpdate:{product:{id:v.input.id,seo:v.input.seo},userErrors:[]}};
    return {collectionUpdate:{collection:{id:v.input.id,seo:v.input.seo},userErrors:[]}};
  };
  const catalog=await api.catalog();assert.equal(catalog.pages.length,3);
  await api.updateSEO({id:'p1',type:'product'},{title:'A',description:'B'});
  await api.updateSEO({id:'c1',type:'collection'},{title:'C',description:'D'});
  assert(calls.some(c=>c.q.includes('productUpdate(product: $input)')));
  assert(calls.some(c=>c.q.includes('collectionUpdate(input: $input)')));
  assert.deepEqual(Object.keys(calls.at(-1).v.input).sort(),['id','seo']);
});

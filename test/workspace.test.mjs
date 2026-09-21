import {testDatabase} from './database-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialWorkspace,ensureWorkspace,performOperation,fingerprint,assertAllowedShop} from '../app/lib/workspace.server.mjs';
const shop='test.myshopify.com';
const page=id=>({id,type:'product',title:'Cat litter refill',url:'https://nosweatusa.com/products/refill',handle:'refill',descriptionHtml:'<p>Source product description.</p>',seo:{title:'',description:''},images:[{id:'gid://shopify/MediaImage/1',url:'https://cdn.shopify.com/a.jpg',altText:''}]});
async function fixture(t){
 const db=await testDatabase(t);
 const state=initialWorkspace(shop);state.catalog.pages=[page('p1'),page('p2')];
 await ensureWorkspace(db,shop);await db.seoWorkspace.update({where:{shop},data:{data:JSON.stringify(state)}});
 const live=new Map(state.catalog.pages.map(p=>[p.id,structuredClone(p)]));let alt='';const writes=[];
 const admin={graphql:async(q,{variables:v})=>{
  let data;
  if(q.includes('query Current'))data={node:live.get(v.id)};
  else if(q.includes('productUpdate')){writes.push(v.input);const p=live.get(v.input.id);p.seo=v.input.seo;data={productUpdate:{product:p,userErrors:[]}};}
  else if(q.includes('query ImageAlt'))data={node:{id:v.id,alt}};
  else if(q.includes('fileUpdate')){writes.push(v.files);alt=v.files[0].alt;data={fileUpdate:{files:[{id:v.files[0].id,alt}],userErrors:[]}};}
  else throw new Error('Unexpected operation');
  return Response.json({data});
 }};
 const run=input=>performOperation({db,shop,admin,input});
 const get=async()=>JSON.parse((await db.seoWorkspace.findUniqueOrThrow({where:{shop}})).data);
 return {db,run,get,live,writes};
}
test('drafts require exact review and current Shopify values; empty original SEO can be restored',async t=>{
 const {db,run,get,live,writes}=await fixture(t);
 await run({intent:'save-draft',pageId:'p1',title:'Reviewed title',description:'Reviewed description'});
 const draft=(await get()).drafts.p1;assert.equal(writes.length,0);
 await assert.rejects(run({intent:'apply',pageId:'p1',confirm:'APPLY',draftHash:'old'}),/başqa pəncərədə/);
 live.get('p1').seo.title='Edited outside';
 await assert.rejects(run({intent:'apply',pageId:'p1',confirm:'APPLY',draftHash:fingerprint(draft.after)}),/Shopify-da dəyişib/);
 assert.equal(writes.length,0);live.get('p1').seo.title='';
 await run({intent:'apply',pageId:'p1',confirm:'APPLY',draftHash:fingerprint(draft.after)});
 assert.equal(writes.length,1);assert.equal((await get()).drafts.p1,undefined);
 const change=await db.seoChange.findFirst();assert.equal(change.status,'applied');
 await run({intent:'restore-draft',changeId:change.id});
 const restore=(await get()).drafts.p1;assert.deepEqual(restore.after,{title:'',description:''});assert.equal(writes.length,1);
 await run({intent:'apply',pageId:'p1',confirm:'APPLY',draftHash:fingerprint(restore.after)});
 assert.deepEqual(live.get('p1').seo,{title:'',description:''});
});
test('bulk application preserves completed writes and stops on stale source',async t=>{
 const {run,get,live,writes}=await fixture(t);
 await run({intent:'bulk-draft',pageIds:JSON.stringify(['p1','p2'])});
 const state=await get();live.get('p2').seo.title='External change';
 const result=await run({intent:'bulk-apply',confirm:'APPLY',batch:JSON.stringify(Object.values(state.drafts).map(d=>({pageId:d.pageId,draftHash:fingerprint(d.after)})))});
 assert.match(result.message,/1\/2/);assert.equal(writes.length,1);assert.equal((await get()).drafts.p1,undefined);assert((await get()).drafts.p2);
});
test('image edits reject unknown IDs, require exact reviewed alt and keep a history',async t=>{
 const {run,get,writes,db}=await fixture(t);
 await assert.rejects(run({intent:'image-draft',imageId:'unknown',alt:'text'}),/tapılmadı/);
 const imageId='gid://shopify/MediaImage/1';
 await run({intent:'image-draft',imageId,alt:'Bag shown from front'});
 await assert.rejects(run({intent:'image-apply',imageId,confirm:'APPLY',alt:'different'}),/dəyişib/);assert.equal(writes.length,0);
 await run({intent:'image-apply',imageId,confirm:'APPLY',alt:'Bag shown from front'});
 assert.equal((await get()).catalog.pages[1].images[0].altText,'Bag shown from front');
 assert.equal((await db.seoChange.findFirst()).status,'applied');
});
test('per-shop lock blocks concurrent mutations and is released after failure',async t=>{
 const {db,run}=await fixture(t);
 await db.seoWorkspace.update({where:{shop},data:{lockToken:'other',lockUntil:new Date(Date.now()+60000)}});
 await assert.rejects(run({intent:'keyword',pageId:'p1',keyword:'cat litter'}),/davam edir/);
 await db.seoWorkspace.update({where:{shop},data:{lockUntil:null}});
 await assert.rejects(run({intent:'unknown'}));
 assert.equal((await db.seoWorkspace.findUniqueOrThrow({where:{shop}})).lockToken,null);
});
test('different merchant is denied',()=>{assert.throws(()=>assertAllowedShop('other.myshopify.com',shop),e=>e.status===403);});

test('growth checks and weekly task completion persist without Shopify writes',async t=>{
 const {run,get,writes}=await fixture(t);
 await run({intent:'growth-check',pageId:'p1',check:'shipping',status:'yes'});assert.equal((await get()).growth.checks.p1.shipping.status,'yes');
 await run({intent:'growth-task',taskId:'setup:google',done:'true'});assert((await get()).growth.done['setup:google']);
 await assert.rejects(run({intent:'growth-check',pageId:'foreign',check:'shipping',status:'yes'}));assert.equal(writes.length,0);
});

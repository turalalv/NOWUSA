import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

test('minified Shopify boundary preserves session recovery HTML and real errors',async()=>{
 const dir=await mkdtemp(resolve('node_modules/.cache/boundary-test-'));
 try {
  const outfile=join(dir,'boundary.mjs');
  await build({entryPoints:['app/lib/shopify-boundary.ts'],bundle:true,minify:true,platform:'node',format:'esm',packages:'external',outfile});
  const {shopifyBoundaryError}=await import(pathToFileURL(outfile).href);
  const html='<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key="test"></script>';
  // Hydrated production responses may have minified constructor names or be plain objects.
  for(const response of [{status:200,statusText:'',internal:false,data:html},Object.assign(new (class a {})(),{status:200,statusText:'',internal:false,data:html})]){
   assert.equal(shopifyBoundaryError(response).props.dangerouslySetInnerHTML.__html,html);
  }
  const failure=new Error('database unavailable');
  assert.throws(()=>shopifyBoundaryError(failure),e=>e===failure);
  assert.throws(()=>shopifyBoundaryError({status:200,data:html}));
 } finally {await rm(dir,{recursive:true,force:true});}
});

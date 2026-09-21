import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

test('dashboard renders catalog pages with unset Shopify SEO fields',async()=>{
 const dir=await mkdtemp(resolve('node_modules/.cache/dashboard-test-'));
 try{
  const outfile=join(dir,'render.mjs');
  await build({stdin:{contents:`import React from 'react';import {renderToString} from 'react-dom/server';import Dashboard from './app/components/SeoDashboard';import {initialWorkspace,dashboardData} from './app/lib/workspace.server.mjs';const state=initialWorkspace('preview.myshopify.com');state.catalog.pages=[{id:'p',type:'product',title:'Product',handle:'p',seo:{title:null,description:null},images:[],descriptionHtml:''}];export default renderToString(<Dashboard data={{...dashboardData(state),canWrite:true}} busy={false} onAction={()=>{}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},outfile,jsx:'automatic'});
  const {default:html}=await import(pathToFileURL(outfile).href);
  assert.match(html,/Katalog dağılımı/);
  assert.match(html,/Başlık: 0\/1 sayfa/);
  assert.match(html,/Meta açıklama: 0\/1 sayfa/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

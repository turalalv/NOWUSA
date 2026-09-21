// Local UI preview. All data is synthetic; no Shopify or Google requests are made.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialWorkspace,dashboardData} from '../app/lib/workspace.server.mjs';
const state=initialWorkspace('preview.myshopify.com');
state.catalog.syncedAt=new Date().toISOString();
state.catalog.pages=Array.from({length:8},(_,i)=>({id:`p${i}`,type:i<6?'product':'collection',title:['Antiperspirant Spray','Daily Protection','Travel Set','Sensitive Care','Active Pack','Fresh Essentials','Best Sellers','Everyday Care'][i],handle:`sample-${i}`,descriptionHtml:'<p>Sample product information for the local interface preview.</p>',seo:{title:i<5?'Sample page '+i:'',description:i<3?'Sample meta description.':''},images:[],status:'ACTIVE',url:`https://nosweatusa.com/products/sample-${i}`}));
const data={...dashboardData(state),canWrite:true,canWriteFiles:true,compressionConfigured:true,canManageGoogle:true,google:{configured:true,connected:false,properties:[],property:'',autoSync:false,syncedAt:null},compressions:[]};
const dir=await mkdtemp(join(tmpdir(),'nowusa-design-'));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Dashboard from './app/components/SeoDashboard';window.actions=[];createRoot(document.getElementById('root')).render(<Dashboard data={${JSON.stringify(data)}} busy={false} onAction={a=>{window.actions.push(a);}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const html='<!doctype html><html lang="tr" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOWUSA · Türkçe tasarım önizlemesi</title><script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script><link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"><link rel="stylesheet" href="/app.css"><style>body{margin:0}#preview-note{padding:6px 16px;background:#fff8df;color:#655526;font:11px system-ui}</style></head><body><div id="preview-note">Tasarım önizlemesi · Örnek veriler · Canlı mağazaya bağlı değil</div><div id="root"></div><script src="/app.js"></script></body></html>';
const server=createServer(async(req,res)=>{const name=req.url==='/app.js'?'app.js':req.url==='/app.css'?'app.css':null;res.setHeader('Content-Type',name?.endsWith('js')?'text/javascript':name?'text/css':'text/html; charset=utf-8');res.end(name?await readFile(join(dir,name)):html);});
server.listen(4173,'0.0.0.0',()=>console.log('NOWUSA design preview: http://localhost:4173'));

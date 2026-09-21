// Isolated UI preview; no external API requests or merchant writes.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialWorkspace,dashboardData} from '../app/lib/workspace.server.mjs';
import {suiteData} from '../app/lib/seo-suite.server.mjs';
const state=initialWorkspace('preview.myshopify.com'),data=suiteData(state),dashboard={...dashboardData(state),canWrite:true,canManageGoogle:true};const dir=await mkdtemp(join(tmpdir(),'nowusa-suite-'));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Panel from './app/components/SeoDashboard';window.actions=[];function Preview(){const [open,setOpen]=React.useState(true);return <Panel data={${JSON.stringify(dashboard)}} suite={${JSON.stringify(data)}} suiteOpen={open} onSuiteOpen={setOpen} busy={false} onAction={a=>window.actions.push(a)}/>;}createRoot(document.getElementById('root')).render(<Preview/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const html='<!doctype html><html lang="tr" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script><link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"><link rel="stylesheet" href="/app.css"><title>SEO Merkezi önizleme</title></head><body style="margin:0;background:#f2f6f8"><p style="padding:6px 16px;font:12px system-ui">Yerel önizleme · Canlı mağazaya bağlı değil</p><div id="root"></div><script src="/app.js"></script></body></html>';
createServer(async(req,res)=>{const name=req.url==='/app.js'?'app.js':req.url==='/app.css'?'app.css':null;res.setHeader('Content-Type',name?.endsWith('js')?'text/javascript':name?'text/css':'text/html; charset=utf-8');res.end(name?await readFile(join(dir,name)):html);}).listen(Number(process.env.PREVIEW_PORT||4174),'0.0.0.0',()=>console.log('SEO Merkezi preview: http://localhost:4174'));

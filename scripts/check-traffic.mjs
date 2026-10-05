// Synthetic fixture: validates rendering and controls without contacting Analytics.
import {build} from 'esbuild';
import {mkdtemp,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {initialWorkspace,dashboardData} from '../app/lib/workspace.server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH||'playwright');
const state=initialWorkspace('preview.myshopify.com');
const source={sessionSource:'instagram',sessionMedium:'paid_social',sessionCampaignName:'Örnek kampanya',sessionDefaultChannelGroup:'Paid Social',country:'United States',countryId:'US',label:'Instagram · Reklam',sessions:30,totalUsers:25};
const report={period:'week',start:'2026-09-28',end:'2026-10-04',previousStart:'2026-09-21',previousEnd:'2026-09-27',timeZone:'America/New_York',partial:false,generatedAt:'2026-10-05T12:00:00Z',property:'properties/123',name:'Örnek mülk',current:{sessions:40,totalUsers:32,screenPageViews:70},previous:{sessions:20,totalUsers:15,screenPageViews:30},daily:[{date:'20260928',sessions:10},{date:'20260929',sessions:30}],sources:[source,{...source,country:'Türkiye',countryId:'TR',sessionSource:'(direct)',sessionMedium:'(none)',label:'Direct / kaynağı belirtilmeyen',sessions:10,totalUsers:9}],countries:[{country:'United States',countryId:'US',sessions:30,totalUsers:25},{country:'Türkiye',countryId:'TR',sessions:10,totalUsers:9}],products:[{...source,path:'/products/antiperspirant',title:'Örnek Antiperspirant Spray',image:'',screenPageViews:15}],quality:{limited:false,thresholded:false,otherRow:false,sampled:false}};
const traffic={auto:false,reports:{week:report},connection:{connected:true,configured:true,serviceEmail:'',property:report.property,name:report.name,timeZone:report.timeZone,measurementId:'G-EXAMPLE',properties:[{property:report.property,name:report.name}]}};
const data={...dashboardData(state),traffic,canWrite:true,canWriteFiles:true};
const dir=await mkdtemp(join(tmpdir(),'traffic-ui-'));
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Dashboard from './app/components/SeoDashboard';window.actions=[];createRoot(document.getElementById('root')).render(<Dashboard data={${JSON.stringify(data)}} busy={false} onAction={a=>window.actions.push(a)}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script><link rel="stylesheet" href="/app.css"></head><body style="margin:0"><div style="background:#fff4d4;padding:10px;font:12px system-ui">ÖRNEK VERİ · Canlı Analytics bağlantısı değil</div><div id="root"></div><script src="/app.js"></script></body></html>';
const server=createServer(async(req,res)=>{const file=req.url==='/app.js'?'app.js':req.url==='/app.css'?'app.css':null;res.setHeader('Content-Type',file?.endsWith('.js')?'text/javascript':file?'text/css':'text/html; charset=utf-8');res.end(file?await readFile(join(dir,file)):html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1380,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>customElements.get('s-button'));
 await page.getByRole('button',{name:'Ziyaretçi analitiği',exact:true}).click();await page.getByRole('heading',{name:'Ziyaretçiler nereden geliyor?'}).waitFor();
 await page.getByRole('combobox',{name:'Ülke',exact:true}).selectOption('TR');assert.equal(await page.getByText('Örnek Antiperspirant Spray',{exact:true}).count(),0);
 await page.getByRole('combobox',{name:'Ülke',exact:true}).selectOption('');await page.getByRole('combobox',{name:'Trafik kaynağı',exact:true}).selectOption('instagram');assert.equal(await page.getByText('Örnek Antiperspirant Spray',{exact:true}).count(),1);
 await page.getByRole('button',{name:'PDF indir',exact:true}).click();assert.deepEqual((await page.evaluate(()=>window.actions)).at(-1),{intent:'traffic-pdf',period:'week'});
 await page.getByRole('combobox',{name:'Dönem',exact:true}).selectOption('today');await page.getByText('Bu dönem için rapor hazırlayın',{exact:true}).waitFor();await page.getByRole('button',{name:'Verileri getir / yenile',exact:true}).click();assert.equal((await page.evaluate(()=>window.actions)).at(-1).period,'today');
 await page.getByRole('combobox',{name:'Dönem',exact:true}).selectOption('week');
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/traffic-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/traffic-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile overflow');assert.deepEqual(errors,[]);
 console.log('Traffic UI passed: source/country filters, period selection, PDF, empty states, desktop/mobile, no page errors.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}

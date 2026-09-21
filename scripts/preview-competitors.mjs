// Local-only preview of the real component, without Shopify authentication or API calls.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {importCompetitor,competitorKeywords} from '../app/lib/competitors.mjs';
import {importBacklinkCSV,backlinkComparison} from '../app/lib/backlink-import.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const state={};
for(const site of ['sweatblock','certaindri']) {
  const file=resolve(root,'../../sweatblock-seo-scraper/output',site,'pages.json');
  try {importCompetitor(state,await readFile(file,'utf8'));}
  catch(error) {console.warn(`${site}: initial report not loaded (${error.message})`);}
}
const data=()=>({reports:Object.values(state.competitors||{}),keywords:competitorKeywords(state.competitors),backlinks:backlinkComparison(state)});
const dir=await mkdtemp(join(tmpdir(),'competitor-preview-'));
await build({stdin:{contents:`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import Panel from './app/components/CompetitorPanel';import Backlinks from './app/components/BacklinkImportPanel';
function Preview(){const[data,setData]=useState(null),[busy,setBusy]=useState(false),[result,setResult]=useState(),[tab,setTab]=useState('seo');
React.useEffect(()=>{fetch('/data').then(r=>r.json()).then(setData).catch(()=>setResult({error:'Məlumat oxunmadı.'}));},[]);
async function onImport(json){setBusy(true);try{const r=await fetch('/import',{method:'POST',headers:{'Content-Type':'application/json'},body:json});const response=await r.json();if(!r.ok)throw Error(response.error);setData(response);setResult({message:'Lokal hesabat yeniləndi.'});}catch(e){setResult({error:e.message});}finally{setBusy(false);}}
async function importLinks(input){setBusy(true);try{const r=await fetch('/backlinks/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const response=await r.json();if(!r.ok)throw Error(response.error);setData(response);setResult({message:'Backlink CSV hesabatı saxlanıldı.'});}catch(e){setResult({error:e.message});}finally{setBusy(false);}}
return data?<><nav style={{padding:16}}><button disabled={busy} onClick={()=>{setTab('seo');setResult();}}>Rəqib SEO</button> <button disabled={busy} onClick={()=>{setTab('backlinks');setResult();}}>Backlink müqayisəsi</button></nav>{tab==='seo'?<Panel data={data} busy={busy} result={result} onImport={onImport}/>:<Backlinks data={data.backlinks} busy={busy} result={result} onImport={importLinks}/>}</>:<p>{result?.error||'Yüklənir…'}</p>;}
createRoot(document.getElementById('root')).render(<Preview/>);`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const html='<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rəqib SEO — lokal test</title><script src="https://cdn.shopify.com/shopifycloud/polaris-1.js"></script><style>body{margin:0;font-family:system-ui}aside{padding:14px;background:#fff3cd}input{display:block;margin:12px 0;max-width:100%}</style></head><body><aside>Lokal sınaq · Canlı mağazaya bağlantı yoxdur. İlkin nəticələr hər saytdan 3 real səhifədir. Importlar yalnız bu proses işləyərkən saxlanır.</aside><div id="root"></div><script src="/app.js"></script></body></html>';
const port=Number(process.env.PREVIEW_PORT||8790);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid PREVIEW_PORT');
const origin=`http://localhost:${port}`;
const server=createServer(async(req,res)=>{
  const reply=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(body):body);};
  if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host))return reply(403,{error:'Local host only'});
  try {
    if(req.method==='GET'&&req.url==='/')return reply(200,html,'text/html');
    if(req.method==='GET'&&req.url==='/app.js')return reply(200,await readFile(join(dir,'app.js'),'utf8'),'text/javascript');
    if(req.method==='GET'&&req.url==='/data')return reply(200,data());
    if(req.method==='POST'&&['/import','/backlinks/import'].includes(req.url)){
      if(![origin,`http://127.0.0.1:${port}`].includes(req.headers.origin))return reply(403,{error:'Origin rejected'});
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>3_000_000)return reply(413,{error:'Sorğu maksimum 3 MB'});chunks.push(chunk);}
      const text=Buffer.concat(chunks).toString('utf8');
      if(req.url==='/import')importCompetitor(state,text);else importBacklinkCSV(state,JSON.parse(text));
      return reply(200,data());
    }
    reply(404,{error:'Not found'});
  }catch(error){reply(400,{error:error.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Rəqib SEO lokal önizləmə: ${origin}\nDayandırmaq: Ctrl+C`));
async function stop(){server.close();await rm(dir,{recursive:true,force:true});process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);

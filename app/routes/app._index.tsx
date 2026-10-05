import {suiteData,reportCSV,organicCSV} from '../lib/seo-suite.server.mjs';
import type {SuiteData} from '../components/SeoSuitePanel';
import {shopifyBoundaryError} from '../lib/shopify-boundary';
import { useEffect } from 'react';
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useFetcher, useLoaderData, useRouteError, useSearchParams } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticate } from '../shopify.server';
import db from '../db.server';
import {googleStatus,prepareGoogle} from '../lib/google.server.mjs';
import {canManageGoogle} from '../lib/google-permissions.server.mjs';
import {compressionList} from '../lib/compression.server.mjs';
import {key} from '../lib/secrets.server.mjs';
import { assertAllowedShop, ensureWorkspace, dashboardData, performOperation, exportAudit } from '../lib/workspace.server.mjs';
import SeoDashboard from '../components/SeoDashboard';
import type { ActionInput, ActionResult, Dashboard } from '../lib/types';
import {weeklyData} from '../lib/weekly-reports.mjs';
import {emailConfigured} from '../lib/weekly-reports.server.mjs';
import {trafficData} from '../lib/traffic.mjs';
import {trafficStatus,prepareTraffic} from '../lib/traffic.server.mjs';

export const config = { maxDuration: 600 };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  assertAllowedShop(session.shop);
  const row = await ensureWorkspace(db, session.shop);
  const changes = await db.seoChange.findMany({ where: { shop: session.shop }, orderBy: { createdAt: 'desc' }, take: 50 });
  const data = dashboardData(JSON.parse(row.data), changes);
  if(canManageGoogle(session)){
    const connection=await trafficStatus(db,session.shop),traffic=trafficData(JSON.parse(row.data));
    traffic.reports=Object.fromEntries(Object.entries(traffic.reports).filter(([,report]:[string,any])=>report.property===connection.property));
    Object.assign(data,{traffic:{...traffic,connection}});
  }
  if(canManageGoogle(session))Object.assign(data,{weekly:{...weeklyData(JSON.parse(row.data)),emailConfigured:emailConfigured(),canReadOrders:Boolean(session.scope?.split(',').includes('read_orders')),deliveries:await db.seoReportDelivery.findMany({where:{shop:session.shop},select:{reportId:true,status:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:52})}});
  let compressionConfigured=false;try{key();compressionConfigured=true;}catch{ /* Integration key has not been configured. */ }
  return { ...data, suite:suiteData(JSON.parse(row.data)), google:await googleStatus(db,session.shop),compressions:await compressionList(db,session.shop),compressionConfigured,canManageGoogle:canManageGoogle(session),canWrite: session.scope?.split(',').includes('write_products') || false, canWriteFiles: session.scope?.split(',').includes('write_files') || false } as Dashboard & {suite:SuiteData};
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  assertAllowedShop(session.shop);
  try {
    const text = await request.text();
    if (text.length > 3_000_000) throw new Error("İstek boyutu 3 MB sınırını aşıyor.");
    const input = JSON.parse(text) as ActionInput;
    if(input.intent.startsWith('traffic-')){
      if(!canManageGoogle(session))throw new Error('Ziyaretçi raporları için yetkilendirilmiş yönetici olmalısınız.');
      if(!['traffic-connect','traffic-service','traffic-property','traffic-settings','traffic-sync','traffic-disconnect','traffic-pdf'].includes(input.intent))throw new Error('Geçersiz ziyaretçi işlemi.');
      if(input.intent==='traffic-connect')return {ok:true,connectURL:await prepareTraffic(db,session.shop)};
      if(input.intent==='traffic-pdf'){
        const workspace=await ensureWorkspace(db,session.shop),connection=await trafficStatus(db,session.shop);
        const report=JSON.parse(workspace.data).traffic?.reports?.[input.period];
        if(!report||report.property!==connection.property)throw new Error('Bu dönem için ziyaretçi raporu bulunamadı.');
        const {trafficPDF}=await import('../lib/traffic-export.server.mjs');
        const pdf=await trafficPDF(report) as Buffer;
        return {ok:true,download:pdf.toString('base64'),encoding:'base64',mime:'application/pdf',filename:`no-sweat-visitors-${report.start}-${report.end}.pdf`} satisfies ActionResult;
      }
    }
    if(input.intent.startsWith('weekly-')){
      if(!canManageGoogle(session))throw new Error('Haftalık raporlar için mağaza sahibi veya yetkilendirilmiş yönetici olmalısınız.');
      if(!['weekly-settings','weekly-generate','weekly-email','weekly-pdf'].includes(input.intent))throw new Error('Geçersiz rapor işlemi.');
      if(input.intent==='weekly-pdf'){
        const row=await ensureWorkspace(db,session.shop);
        const report=JSON.parse(row.data).weekly?.reports?.find((r:{id:string})=>r.id===input.reportId);
        if(!report)throw new Error('Haftalık rapor bulunamadı.');
        const {reportPDF}=await import('../lib/weekly-report-export.server.mjs');
        const pdf=await reportPDF(report) as Buffer;
        return {ok:true,download:pdf.toString('base64'),encoding:'base64',mime:'application/pdf',filename:`no-sweat-seo-${report.end}.pdf`} satisfies ActionResult;
      }
    }
    if((['google-connect','google-disconnect','google-settings'].includes(input.intent)||['suite-settings','suite-provider','suite-daily','suite-audit-settings','suite-audit'].includes(input.intent))&&!canManageGoogle(session))throw new Error("Google bağlantısını yönetmek için mağaza sahibi veya ayrıca yetkilendirilmiş bir kullanıcı olmalısınız.");
    if(input.intent==='google-connect')return {ok:true,connectURL:await prepareGoogle(db,session.shop)};
    if(input.intent==='refresh')return {ok:true};
    if (['suite-export','suite-organic-export'].includes(input.intent)) {
      const row=await ensureWorkspace(db,session.shop);
      return {ok:true,download:(input.intent==='suite-organic-export'?organicCSV:reportCSV)(suiteData(JSON.parse(row.data))),filename:input.intent==='suite-organic-export'?'nowusa-organik-siralamalar.csv':'nowusa-seo-merkezi.csv'};
    }
    if (input.intent === 'export') {
      const row = await ensureWorkspace(db, session.shop);
      return { ok: true, download: exportAudit(JSON.parse(row.data)), filename: 'nosweat-seo-audit.csv' } satisfies ActionResult;
    }
    if (['apply','bulk-apply'].includes(input.intent) && !session.scope?.split(',').includes('write_products')) throw new Error("Canlı değişiklik için write_products izni gerekir.");
    if (['image-apply','compression-apply'].includes(input.intent) && !session.scope?.split(',').includes('write_files')) throw new Error("Görsel değişikliği için write_files izni gerekir.");
    return await performOperation({ db, shop: session.shop, admin, input, canReadOrders:Boolean(session.scope?.split(',').includes('read_orders')) }) as ActionResult;
  } catch (error) {
    if (error instanceof Response) throw error;
    return Response.json({ error: error instanceof Error ? error.message : "İşlem başarısız oldu." }, { status: 400 });
  }
};
export default function Index() {
  const data = useLoaderData<typeof loader>();
  const [params,setParams]=useSearchParams();
  const fetcher = useFetcher<ActionResult>();
  const bridge = useAppBridge();
  useEffect(() => {
    if (fetcher.data?.message) bridge.toast.show(fetcher.data.message);
    if (fetcher.data?.download) {
      const content=fetcher.data.encoding==='base64'?Uint8Array.from(atob(fetcher.data.download),c=>c.charCodeAt(0)):fetcher.data.download;
      const href = URL.createObjectURL(new Blob([content], { type: fetcher.data.mime||'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = href; link.download = fetcher.data.filename || 'audit.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
  }, [fetcher.data, bridge]);
  return <SeoDashboard suite={data.suite} suiteOpen={params.get('section')==='seo-suite'} onSuiteOpen={open=>setParams(previous=>{const next=new URLSearchParams(previous);if(open)next.set('section','seo-suite');else next.delete('section');return next;},{replace:true,preventScrollReset:true})} data={data} busy={fetcher.state !== 'idle'} result={fetcher.data} onAction={input => fetcher.submit(input, { method: 'POST', encType: 'application/json' })} />;
}
export function ErrorBoundary() { return shopifyBoundaryError(useRouteError()); }
export const headers: HeadersFunction = args => {const headers=new Headers(boundary.headers(args));headers.set('Cache-Control','private, no-store');return headers;};

import {shopifyBoundaryError} from '../lib/shopify-boundary';
import {useEffect} from 'react';
import {useFetcher,useLoaderData,useRouteError} from 'react-router';
import type {ActionFunctionArgs,HeadersFunction,LoaderFunctionArgs} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {authenticate} from '../shopify.server';
import db from '../db.server';
import {assertAllowedShop,ensureWorkspace,performOperation} from '../lib/workspace.server.mjs';
import {suiteData,reportCSV} from '../lib/seo-suite.server.mjs';
import {canManageGoogle} from '../lib/google-permissions.server.mjs';
import SeoSuitePanel from '../components/SeoSuitePanel';
import type {SuiteData} from '../components/SeoSuitePanel';
import type {ActionInput,ActionResult} from '../lib/types';
export const loader=async({request}:LoaderFunctionArgs)=>{const {session}=await authenticate.admin(request);assertAllowedShop(session.shop);const row=await ensureWorkspace(db,session.shop);return {suite:suiteData(JSON.parse(row.data)) as SuiteData,canManage:canManageGoogle(session)};};
export const action=async({request}:ActionFunctionArgs)=>{
 const {session,admin}=await authenticate.admin(request);assertAllowedShop(session.shop);
 try{const text=await request.text();if(text.length>3_000_000)throw new Error('İstek 3 MB sınırını aşıyor.');const input=JSON.parse(text) as ActionInput;if(!input.intent?.startsWith('suite-'))throw new Error('İşlem geçersiz.');if(['suite-settings','suite-provider','suite-daily','suite-audit-settings','suite-audit'].includes(input.intent)&&!canManageGoogle(session))throw new Error('Bu işlem için mağaza sahibi veya yetkilendirilmiş kullanıcı olmalısınız.');
 if(input.intent==='suite-export'){const row=await ensureWorkspace(db,session.shop);return {ok:true,download:reportCSV(suiteData(JSON.parse(row.data))),filename:'nowusa-seo-merkezi.csv'};}
 return await performOperation({db,shop:session.shop,admin,input});
 }catch(error){if(error instanceof Response)throw error;return Response.json({error:error instanceof Error?error.message:'İşlem başarısız.'},{status:400});}
};
export default function SeoSuite(){const data=useLoaderData<typeof loader>(),fetcher=useFetcher<ActionResult>();useEffect(()=>{if(!fetcher.data?.download)return;const url=URL.createObjectURL(new Blob([fetcher.data.download],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=fetcher.data.filename||'seo.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},[fetcher.data]);return <SeoSuitePanel data={data.suite} canManage={data.canManage} busy={fetcher.state!=='idle'} result={fetcher.data} onAction={input=>fetcher.submit(input,{method:'POST',encType:'application/json'})}/>;}
export function ErrorBoundary(){return shopifyBoundaryError(useRouteError());}
export const headers:HeadersFunction=args=>{const h=new Headers(boundary.headers(args));h.set('Cache-Control','private, no-store');return h;};

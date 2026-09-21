import {shopifyBoundaryError} from '../lib/shopify-boundary';
import CompetitorPanel from '../components/CompetitorPanel';
import {useFetcher, useLoaderData, useRouteError} from 'react-router';
import type {HeadersFunction, LoaderFunctionArgs} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {authenticate} from '../shopify.server';
import db from '../db.server';
import {assertAllowedShop, ensureWorkspace} from '../lib/workspace.server.mjs';
import {competitorKeywords} from '../lib/competitors.mjs';
import type {ActionResult} from '../lib/types';
export {action} from './app._index';

type Report = {domain:string;importedAt:string;pages:{url:string;title:string;description:string;metaKeywords:string;scrapedAt:string;headings:{level:string;text:string}[];issues:string[];keywords:{keyword:string;count:number}[]}[]};
export const loader = async ({request}:LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  assertAllowedShop(session.shop);
  const row = await ensureWorkspace(db, session.shop);
  const reports = (JSON.parse(row.data).competitors || {}) as Record<string,Report>;
  return {reports:Object.values(reports), keywords:competitorKeywords(reports) as {keyword:string;count:number;pages:number;domains:string[]}[]};
};

export default function Competitors() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResult>();
  return <CompetitorPanel data={data} busy={fetcher.state !== 'idle'} result={fetcher.data} onImport={json=>fetcher.submit({intent:'competitor-import',json},{method:'POST',encType:'application/json'})} />;
}
export function ErrorBoundary() {return shopifyBoundaryError(useRouteError());}
export const headers:HeadersFunction = args=>{const result=new Headers(boundary.headers(args));result.set('Cache-Control','private, no-store');return result;};

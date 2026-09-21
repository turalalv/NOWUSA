import {useFetcher,useLoaderData,useRouteError} from 'react-router';
import type {LoaderFunctionArgs,HeadersFunction} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {authenticate} from '../shopify.server';
import db from '../db.server';
import {assertAllowedShop,ensureWorkspace} from '../lib/workspace.server.mjs';
import {backlinkComparison} from '../lib/backlink-import.mjs';
import BacklinkImportPanel from '../components/BacklinkImportPanel';
import type {BacklinkData} from '../components/BacklinkImportPanel';
import type {ActionResult} from '../lib/types';
export {action} from './app._index';
export const loader=async({request}:LoaderFunctionArgs)=>{const {session}=await authenticate.admin(request);assertAllowedShop(session.shop);const row=await ensureWorkspace(db,session.shop);return backlinkComparison(JSON.parse(row.data)) as BacklinkData;};
export default function BacklinkImport(){const data=useLoaderData<typeof loader>(),fetcher=useFetcher<ActionResult>();return <BacklinkImportPanel data={data} busy={fetcher.state!=='idle'} result={fetcher.data} onImport={input=>fetcher.submit({intent:'backlink-csv-import',...input},{method:'POST',encType:'application/json'})}/>;}
export function ErrorBoundary(){return boundary.error(useRouteError());}
export const headers:HeadersFunction=args=>{const result=new Headers(boundary.headers(args));result.set('Cache-Control','private, no-store');return result;};

import type {LoaderFunctionArgs} from 'react-router';
import db from '../db.server';
import {imageResponse} from '../lib/asset-response.server.mjs';
import {validAsset} from '../lib/secrets.server.mjs';
export const loader=async({request,params}:LoaderFunctionArgs)=>{const q=new URL(request.url).searchParams;const variant=q.get('variant')||'';if(!params.id||!validAsset(params.id,variant,q.get('expires')||'',q.get('sig')||''))return new Response("Bulunamadı",{status:404});const row=await db.imageCompression.findUnique({where:{id:params.id}});if(!row)return new Response("Bulunamadı",{status:404});return imageResponse(variant==='original'?row.original:row.optimized,row.mime);};

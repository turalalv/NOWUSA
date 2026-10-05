import type {LoaderFunctionArgs,HeadersFunction} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {authenticate} from '../shopify.server';
import db from '../db.server';
import {assertAllowedShop} from '../lib/workspace.server.mjs';
import {canManageGoogle} from '../lib/google-permissions.server.mjs';
import {visitorReport} from '../lib/visitors.server.mjs';
export async function loader({request}:LoaderFunctionArgs){
 const {session}=await authenticate.admin(request);assertAllowedShop(session.shop);
 if(!canManageGoogle(session))return Response.json({error:'Ziyaret raporu için yönetici erişimi gerekiyor.'},{status:403});
 try{return Response.json(await visitorReport(db,session.shop,new URL(request.url).searchParams.get('period')||'today'),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return Response.json({error:'Canlı ziyaretler alınamadı. Yeniden deneyin.'},{status:400,headers:{'Cache-Control':'private, no-store'}});}
}
export const headers:HeadersFunction=args=>boundary.headers(args);

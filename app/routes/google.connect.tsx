import type {LoaderFunctionArgs} from 'react-router';
import db from '../db.server';
import {startGoogle} from '../lib/google.server.mjs';
export const loader=async({request}:LoaderFunctionArgs)=>{try{const result=await startGoogle(db,new URL(request.url).searchParams.get('ticket'));return new Response(null,{status:302,headers:{Location:result.url,'Set-Cookie':result.cookie,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}catch{return new Response("Bağlantı geçersiz veya süresi dolmuş. Shopify uygulamasından yeniden başlayın.",{status:400,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}};

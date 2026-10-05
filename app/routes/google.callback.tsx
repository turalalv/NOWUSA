import type {LoaderFunctionArgs} from 'react-router';
import db from '../db.server';
import {finishGoogle} from '../lib/google.server.mjs';
import {finishTraffic,isTrafficCallback} from '../lib/traffic.server.mjs';
export const loader=async({request}:LoaderFunctionArgs)=>{
 const p=new URL(request.url).searchParams;
 const headers={'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
 try{
  const analytics=await isTrafficCallback(db,p.get('state'));
  await (analytics?finishTraffic:finishGoogle)(db,{state:p.get('state'),code:p.get('code'),error:p.get('error'),cookie:request.headers.get('cookie')});
  return new Response(analytics?'Analytics bağlantısı hazır. Bu pencereyi kapatıp Shopify uygulamasındaki Ziyaretçi analitiği bölümünü yenileyin.':'Google bağlantısı hazır. Bu pencereyi kapatıp Shopify uygulamasındaki Google bölümünü yenileyin.',{headers:{...headers,'Set-Cookie':`${analytics?'nosweat_analytics_state':'nosweat_google_state'}=; Path=/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}});
 }catch(error){return new Response(error instanceof Error?error.message:'Google bağlantısı kurulamadı.',{status:400,headers});}
};

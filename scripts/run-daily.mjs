const origin=new URL(process.env.SHOPIFY_APP_URL||'');
if(origin.protocol!=='https:'||!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32)throw new Error('Set HTTPS SHOPIFY_APP_URL and a CRON_SECRET with at least 32 characters.');
const response=await fetch(new URL('/jobs/daily',origin),{method:'POST',redirect:'error',headers:{authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(420000)});
if(!response.ok)throw new Error(`Daily sync returned HTTP ${response.status}. Check the app connection and server logs.`);
console.log(await response.text());

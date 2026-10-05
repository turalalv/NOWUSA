import { equal } from './secrets.server.mjs';
import { performOperation, assertAllowedShop } from './workspace.server.mjs';

/** @param {((shop:string) => Promise<any>) | null} getAdmin */
export async function runDaily(request, db, run = performOperation, getAdmin = null) {
  const secret = process.env.CRON_SECRET, shop = process.env.ALLOWED_SHOP;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!secret || secret.length < 32 || !equal(request.headers.get('authorization') || '', `Bearer ${secret}`) || !shop) {
    return new Response('Unauthorized', { status: 401, headers });
  }
  const task = new URL(request.url).searchParams.get('task');
  if (task && !['google', 'backlinks', 'suite', 'weekly'].includes(task)) return new Response('Unknown task', { status: 400, headers });
  assertAllowedShop(shop);
  const row = await db.seoWorkspace.findUnique({ where: { shop } });
  if (!row) return Response.json({ skipped: true }, { headers });
  const state = JSON.parse(row.data);
  const google = await db.googleConnection.findUnique({ where: { shop } });
  const intents = [];
  if ((!task || task === 'google') && google?.autoSync && (!google.syncedAt || Date.now() - google.syncedAt.getTime() > 20 * 3600000)) intents.push('google-sync');
  if ((!task || task === 'backlinks') && state.backlinksAuto) intents.push('backlink-check');
  if ((!task || task === 'suite') && state.seoSuite?.settings?.auto) intents.push('suite-daily');
  if ((!task || task === 'weekly') && state.weekly?.settings?.auto) intents.push('weekly-auto');
  const admin = { graphql: async () => { throw new Error('Scheduled tasks cannot write Shopify.'); } };
  const results = {};
  for (const intent of intents) {
    try {
      let reportAdmin=admin,canReadOrders=false;
      if(intent==='weekly-auto'&&getAdmin){
        try {const context=await getAdmin(shop);reportAdmin=context.admin;canReadOrders=Boolean(context.session?.scope?.split(',').includes('read_orders'));}
        catch { /* Google report still works; sales is explicitly unavailable. */ }
      }
      const result=await run({ db, shop, admin:reportAdmin, canReadOrders, input: { intent } });results[intent]=result.ok===false?'failed':result.message;
      if(intent==='weekly-auto'&&result.ok!==false&&state.weekly?.settings?.email){
        const email=await run({db,shop,admin,input:{intent:'weekly-email-auto'}});
        results['weekly-email']=email.ok===false?'failed':email.message;
      }
    }
    catch { results[intent] = 'failed'; }
  }
  return Response.json(results, { status: Object.values(results).includes('failed') ? 503 : 200, headers });
}

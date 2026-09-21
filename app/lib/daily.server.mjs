import { equal } from './secrets.server.mjs';
import { performOperation, assertAllowedShop } from './workspace.server.mjs';

export async function runDaily(request, db, run = performOperation) {
  const secret = process.env.CRON_SECRET, shop = process.env.ALLOWED_SHOP;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!secret || secret.length < 32 || !equal(request.headers.get('authorization') || '', `Bearer ${secret}`) || !shop) {
    return new Response('Unauthorized', { status: 401, headers });
  }
  const task = new URL(request.url).searchParams.get('task');
  if (task && !['google', 'backlinks'].includes(task)) return new Response('Unknown task', { status: 400, headers });
  assertAllowedShop(shop);
  const row = await db.seoWorkspace.findUnique({ where: { shop } });
  if (!row) return Response.json({ skipped: true }, { headers });
  const state = JSON.parse(row.data);
  const google = await db.googleConnection.findUnique({ where: { shop } });
  const intents = [];
  if ((!task || task === 'google') && google?.autoSync && (!google.syncedAt || Date.now() - google.syncedAt.getTime() > 20 * 3600000)) intents.push('google-sync');
  if ((!task || task === 'backlinks') && state.backlinksAuto) intents.push('backlink-check');
  const admin = { graphql: async () => { throw new Error('Scheduled tasks cannot write Shopify.'); } };
  const results = {};
  for (const intent of intents) {
    try { results[intent] = (await run({ db, shop, admin, input: { intent } })).message; }
    catch { results[intent] = 'failed'; }
  }
  return Response.json(results, { status: Object.values(results).includes('failed') ? 503 : 200, headers });
}

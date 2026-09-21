import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { imageResponse } from '../app/lib/asset-response.server.mjs';
import { runDaily } from '../app/lib/daily.server.mjs';

test('image backups larger than 4.5 MB stream in chunks without changing bytes', async () => {
  const original = Buffer.alloc(6 * 1024 * 1024 + 17, 123);
  const response = imageResponse(original, 'image/png');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-type'), 'image/png');
  const hash = createHash('sha256'); let size = 0, chunks = 0;
  for await (const chunk of response.body) {
    assert(chunk.length <= 65536); hash.update(chunk); size += chunk.length; chunks++;
  }
  assert(chunks > 1); assert.equal(size, original.length);
  assert.equal(hash.digest('hex'), createHash('sha256').update(original).digest('hex'));
});

test('GET cron authenticates, splits tasks, honors opt-in and never exposes a Shopify writer', async t => {
  const previous = { CRON_SECRET: process.env.CRON_SECRET, ALLOWED_SHOP: process.env.ALLOWED_SHOP };
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  process.env.CRON_SECRET = 's'.repeat(32);
  process.env.ALLOWED_SHOP = 'test.myshopify.com';
  let reads = 0, syncedAt = null, autoSync = true, backlinksAuto = true;
  const db = {
    seoWorkspace: { findUnique: async () => { reads++; return { data: JSON.stringify({ backlinksAuto }) }; } },
    googleConnection: { findUnique: async () => ({ autoSync, syncedAt }) },
  };
  const request = (task, method = 'GET') => new Request(`https://app.example/jobs/daily${task ? `?task=${task}` : ''}`, {
    method, headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  assert.equal((await runDaily(new Request('https://app.example/jobs/daily'), db)).status, 401);
  assert.equal(reads, 0);
  const calls = [];
  const run = async ({ input, admin }) => {
    calls.push(input.intent);
    await assert.rejects(admin.graphql(), /cannot write/);
    return { message: 'done' };
  };
  assert.equal((await runDaily(request('google'), db, run)).status, 200);
  assert.deepEqual(calls.splice(0), ['google-sync']);
  await runDaily(request('backlinks'), db, run);
  assert.deepEqual(calls.splice(0), ['backlink-check']);
  syncedAt = new Date();
  await runDaily(request('', 'POST'), db, run);
  assert.deepEqual(calls.splice(0), ['backlink-check']);
  autoSync = false; backlinksAuto = false;
  await runDaily(request(''), db, run); assert.deepEqual(calls, []);
  assert.equal((await runDaily(request('apply'), db, run)).status, 400);
  backlinksAuto = true;
  const failed = await runDaily(request('backlinks'), db, async () => { throw new Error('secret connection string'); });
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('secret'), false);
});

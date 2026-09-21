// CI only: use the isolated PostgreSQL service, never a merchant database.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
const port = 18791;
const child = spawn(process.execPath, ['scripts/start-render.mjs'], {
  env: {
    ...process.env, RENDER: 'true', PORT: String(port),
    SHOPIFY_APP_URL: 'https://render-ci.example',
    SHOPIFY_API_KEY: 'ci-placeholder', SHOPIFY_API_SECRET: 'ci-placeholder',
    ALLOWED_SHOP: 'iyhxfe-mw.myshopify.com',
    INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString('base64'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output = (output + chunk).slice(-8000); });
child.stderr.on('data', chunk => { output = (output + chunk).slice(-8000); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('Render startup exited before becoming ready.');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && await response.text() === 'ok') { ready = true; break; }
    } catch { /* Wait for migrations and the HTTP listener. */ }
    await delay(500);
  }
  if (!ready) throw new Error('Render startup did not become ready within 30 seconds.');
  const cron = await fetch(`http://127.0.0.1:${port}/jobs/daily`, { signal: AbortSignal.timeout(3000) });
  if (cron.status !== 401) throw new Error('Unauthenticated cron access must return 401.');
  console.log('Render startup, PostgreSQL migration, health endpoint and cron authentication passed.');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (child.exitCode === null) {
    const closed = once(child, 'exit');
    child.kill('SIGTERM');
    await closed;
  }
}

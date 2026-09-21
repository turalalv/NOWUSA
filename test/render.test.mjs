import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEnvironment } from '../scripts/render-env.mjs';

const configured = () => ({
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
  SHOPIFY_API_KEY: 'test-key', SHOPIFY_API_SECRET: 'test-secret',
  ALLOWED_SHOP: 'iyhxfe-mw.myshopify.com',
  RENDER_EXTERNAL_URL: 'https://nowusa-test.onrender.com',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString('base64'),
});

test('Render startup uses its public HTTPS origin and preserves generated encryption bytes across restarts', () => {
  const source = configured(), first = renderEnvironment(source), second = renderEnvironment(source);
  assert.equal(first.SHOPIFY_APP_URL, source.RENDER_EXTERNAL_URL);
  assert.equal(first.INTEGRATION_ENCRYPTION_KEY, Buffer.alloc(32, 17).toString('hex'));
  assert.equal(second.INTEGRATION_ENCRYPTION_KEY, first.INTEGRATION_ENCRYPTION_KEY);
  assert.equal(source.SHOPIFY_APP_URL, undefined);
  assert.equal(first.PORT, '10000'); assert.equal(first.HOST, '0.0.0.0');
  const custom = renderEnvironment({ ...source, SHOPIFY_APP_URL: 'https://seo.example.com/', PORT: '3001', INTEGRATION_ENCRYPTION_KEY: 'a'.repeat(64) });
  assert.equal(custom.SHOPIFY_APP_URL, 'https://seo.example.com');
  assert.equal(custom.PORT, '3001'); assert.equal(custom.INTEGRATION_ENCRYPTION_KEY, 'a'.repeat(64));
});

test('Render startup rejects ephemeral SQLite, missing credentials and invalid origins before any migration', () => {
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    assert.throws(() => renderEnvironment({ ...configured(), [name]: 'file:./dev.sqlite' }), /PostgreSQL/);
  }
  assert.throws(() => renderEnvironment({ ...configured(), SHOPIFY_API_SECRET: '' }), /SHOPIFY_API_SECRET/);
  for (const url of ['http://nowusa.onrender.com', 'https://example.com/path', 'https://private-secret@example.com', 'https://example.com/?token=private-secret']) {
    assert.throws(() => renderEnvironment({ ...configured(), SHOPIFY_APP_URL: url }), error => !error.message.includes('private-secret') && /HTTPS origin/.test(error.message));
  }
  for (const value of ['', 'random', Buffer.alloc(31).toString('base64')]) {
    assert.throws(() => renderEnvironment({ ...configured(), INTEGRATION_ENCRYPTION_KEY: value }), /INTEGRATION_ENCRYPTION_KEY/);
  }
  assert.throws(() => renderEnvironment({ ...configured(), PORT: '0' }), /PORT/);
});

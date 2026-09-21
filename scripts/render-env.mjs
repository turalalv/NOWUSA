export function renderEnvironment(source) {
  const env = { ...source };
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    if (!/^postgres(ql)?:\/\//.test(env[name] || '')) {
      throw new Error(`${name} must be a PostgreSQL URL. Render Free cannot persist SQLite.`);
    }
  }
  for (const name of ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'ALLOWED_SHOP']) {
    if (!env[name]?.trim()) throw new Error(`${name} is required.`);
  }
  let origin;
  try { origin = new URL(env.SHOPIFY_APP_URL || env.RENDER_EXTERNAL_URL); }
  catch { throw new Error('Set SHOPIFY_APP_URL or use the Render-provided RENDER_EXTERNAL_URL.'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('SHOPIFY_APP_URL must be an HTTPS origin, without a path or credentials.');
  }
  env.SHOPIFY_APP_URL = origin.origin;
  const value = env.INTEGRATION_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    const bytes = Buffer.from(value, 'base64');
    // Render's generateValue produces 32-byte base64 secrets; the app uses hex.
    if (bytes.length !== 32 || bytes.toString('base64') !== value) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY must be 64 hex characters or a Render-generated 32-byte base64 secret.');
    }
    env.INTEGRATION_ENCRYPTION_KEY = bytes.toString('hex');
  }
  const port = Number(env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  env.PORT = String(port);
  env.HOST = '0.0.0.0';
  env.NODE_ENV = 'production';
  return env;
}

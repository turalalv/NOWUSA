import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderEnvironment } from './render-env.mjs';

let env;
try { env = renderEnvironment(process.env); }
catch (error) { console.error(error.message); process.exit(1); }

// Free web services have no pre-deploy command: migrate before accepting traffic.
// Clients were generated at build time; cold starts do not download dependencies.
const migration = spawnSync(process.execPath, [fileURLToPath(new URL('./migrate-database.mjs', import.meta.url))], {
  env, stdio: 'inherit',
});
if (migration.status !== 0) process.exit(migration.status ?? 1);

const server = spawn(process.execPath, [
  fileURLToPath(new URL('../node_modules/@react-router/serve/bin.js', import.meta.url)),
  fileURLToPath(new URL('../build/server/index.js', import.meta.url)),
], { env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('error', () => { console.error('Could not start the application server.'); process.exit(1); });
server.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGTERM' ? 0 : 1)));

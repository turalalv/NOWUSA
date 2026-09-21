import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const url = process.env.DATABASE_URL || '';
const postgres = /^postgres(ql)?:\/\//.test(url);
if (!postgres && !url.startsWith('file:')) throw new Error('Set DATABASE_URL to a PostgreSQL or local SQLite URL.');
if (process.env.VERCEL && !postgres) throw new Error('Vercel requires PostgreSQL; SQLite cannot persist there.');
if (postgres && !/^postgres(ql)?:\/\//.test(process.env.DIRECT_URL || '')) {
  throw new Error('Set DIRECT_URL to the direct PostgreSQL connection for migrations.');
}
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)),
  'migrate', 'deploy', '--schema', postgres ? 'prisma/postgresql/schema.prisma' : 'prisma/schema.prisma',
], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);

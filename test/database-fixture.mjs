import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

export async function testDatabase(t) {
  let db, migrationRoot;
  if (process.env.TEST_DATABASE_URL) {
    const { PrismaClient: PostgresClient } = await import('@nosweat/postgres-client');
    const url = new URL(process.env.TEST_DATABASE_URL);
    // Every fixture owns a fresh schema, never tables in the supplied default schema.
    const schema = `test_${randomUUID().replaceAll('-', '')}`;
    const admin = new PostgresClient({ datasources: { db: { url: url.href } } });
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('schema', schema);
    db = new PostgresClient({ datasources: { db: { url: url.href } } });
    t.after(async () => {
      await db.$disconnect();
      try { await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await admin.$disconnect(); }
    });
    migrationRoot = new URL('../prisma/postgresql/migrations/', import.meta.url);
  } else {
    const dir = await mkdtemp(join(tmpdir(), 'nosweat-test-'));
    db = new PrismaClient({ datasources: { db: { url: `file:${dir}/test.sqlite` } } });
    t.after(async () => { await db.$disconnect(); await rm(dir, { recursive: true, force: true }); });
    migrationRoot = new URL('../prisma/migrations/', import.meta.url);
  }
  for (const entry of (await readdir(migrationRoot, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const sql = await readFile(new URL(`${entry.name}/migration.sql`, migrationRoot), 'utf8');
    for (const statement of sql.split(';').filter(s => s.trim())) {
      // PostgreSQL migration's public schema is not needed in isolated test schemas.
      if (/CREATE SCHEMA IF NOT EXISTS "public"/.test(statement)) continue;
      await db.$executeRawUnsafe(statement);
    }
  }
  return db;
}

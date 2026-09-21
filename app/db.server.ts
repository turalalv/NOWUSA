import { PrismaClient } from "@prisma/client";
import { PrismaClient as PostgresClient } from "@nosweat/postgres-client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

const postgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '');
if ((process.env.VERCEL || process.env.RENDER) && !postgres) {
  throw new Error('Cloud hosting requires a PostgreSQL DATABASE_URL.');
}
// Both clients are generated from the same models. Reuse connections per instance.
const prisma = global.prismaGlobal ?? (postgres
  ? new PostgresClient() as unknown as PrismaClient
  : new PrismaClient());
global.prismaGlobal = prisma;

export default prisma;

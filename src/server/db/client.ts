import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

// Cached on globalThis so next dev HMR doesn't open a new pool per reload.
const g = globalThis as unknown as { __db?: ReturnType<typeof createDb> };

function createDb() {
  const client = postgres(databaseUrl(), { max: 10 });
  return drizzle(client, { schema });
}

export const db = (g.__db ??= createDb());

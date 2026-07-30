import './load-env';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Turns a connection refusal into instructions instead of a stack trace. */
export function explainDbError(err: unknown, url: string): string {
  const cause = (err as { cause?: { code?: string } })?.cause;
  if (cause?.code !== 'ECONNREFUSED') return err instanceof Error ? err.message : String(err);

  const port = new URL(url).port || '5432';
  return [
    `Cannot reach Postgres at ${new URL(url).host} (from DATABASE_URL).`,
    '',
    port === '5433'
      ? `Port 5433 was the old default — it is now 5544. Update DATABASE_URL in your .env
  (it is gitignored, so git pull does not change it), or set POSTGRES_PORT=5433
  to keep your existing container.`
      : 'Start it with `npm run db:up`, or point DATABASE_URL at a running server.',
  ].join('\n');
}

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (check your .env)');

  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  } catch (err) {
    throw new Error(explainDbError(err, url));
  } finally {
    await client.end();
  }
  console.log('migrations applied');
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations().catch((err: Error) => {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  });
}

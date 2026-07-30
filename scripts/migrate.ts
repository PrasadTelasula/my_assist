import './load-env';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { envSource } from './load-env';

/** Turns a connection refusal into instructions instead of a stack trace. */
export function explainDbError(err: unknown, url: string): string {
  const cause = (err as { cause?: { code?: string } })?.cause;
  if (cause?.code !== 'ECONNREFUSED') return err instanceof Error ? err.message : String(err);

  const fromShell = envSource('DATABASE_URL') === 'shell';
  const port = new URL(url).port || '5432';

  const lines = [`Cannot reach Postgres at ${new URL(url).host}.`, ''];
  if (fromShell) {
    // An exported variable silently beats .env — the most confusing failure here.
    lines.push(
      'DATABASE_URL is exported in your shell, which overrides .env. Run',
      '  unset DATABASE_URL DATABASE_URL_TEST',
      'to use the values from .env instead (or open a new terminal).',
    );
  } else if (port === '5433') {
    lines.push(
      'Port 5433 was the old default — it is now 5544. Update DATABASE_URL in your',
      '.env (it is gitignored, so git pull does not change it), or set',
      'POSTGRES_PORT=5433 to keep your existing container.',
    );
  } else {
    lines.push('Start it with `npm run db:up`, or point DATABASE_URL at a running server.');
  }
  return lines.join('\n');
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

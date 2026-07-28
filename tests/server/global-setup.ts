import { execSync } from 'node:child_process';

import { TEST_DATABASE_URL } from '../../vitest.config';

/**
 * Server tests run against the dedicated test database with migrations and
 * seed applied once per run. The server project's vitest env override points
 * application code (src/server/db/client) at the same URL.
 */
export function setup(): void {
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync('npx tsx scripts/migrate.ts', { env, stdio: 'inherit' });
  execSync('npx tsx scripts/seed.ts', { env, stdio: 'inherit' });
}

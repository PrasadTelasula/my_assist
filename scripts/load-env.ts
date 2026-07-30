import { existsSync, readFileSync } from 'node:fs';

/**
 * Next.js reads .env on its own; plain scripts do not. Importing this module
 * loads it, so `npm run db:migrate` works without exporting DATABASE_URL by
 * hand. Real environment variables always win over the file.
 *
 * Import it *first* — the db client reads DATABASE_URL when its module loads.
 */
export function loadEnv(file = '.env'): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key!] !== undefined) continue;
    process.env[key!] = rawValue!.trim().replace(/^["']|["']$/g, '');
  }
}

loadEnv();

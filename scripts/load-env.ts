import { existsSync, readFileSync } from 'node:fs';

/** Keys that were already in the real environment when this module loaded. */
const shellProvided = new Set<string>();

/**
 * Next.js reads .env on its own; plain scripts do not. Importing this module
 * loads it, so `npm run db:migrate` works without exporting DATABASE_URL by
 * hand. Real environment variables always win over the file — standard dotenv
 * behavior, and the reason `envSource()` exists to explain a surprise.
 *
 * Import it *first* — the db client reads DATABASE_URL when its module loads.
 */
export function loadEnv(file = '.env'): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key!] !== undefined) {
      shellProvided.add(key!);
      continue;
    }
    process.env[key!] = rawValue!.trim().replace(/^["']|["']$/g, '');
  }
}

/** Where a value came from — used to explain why .env appears to be ignored. */
export function envSource(key: string): 'shell' | 'file' {
  return shellProvided.has(key) ? 'shell' : 'file';
}

loadEnv();

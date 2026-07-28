import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = { '@': path.resolve(import.meta.dirname, 'src') };

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@127.0.0.1:5433/my_assist_test';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
        resolve: { alias },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/server/**/*.test.ts'],
          globalSetup: ['tests/server/global-setup.ts'],
          env: { DATABASE_URL: TEST_DATABASE_URL },
          // DB tests share one database; files must not interleave truncates.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
        },
        resolve: { alias },
      },
      {
        plugins: [react()],
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['tests/components/**/*.test.tsx'],
          setupFiles: ['tests/components/setup.ts'],
        },
        resolve: { alias },
      },
    ],
  },
});

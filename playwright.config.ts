import { defineConfig } from '@playwright/test';

// Its own port so an e2e run never collides with a dev server you have open.
const E2E_PORT = process.env.E2E_PORT ?? '7788';
const BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // Environments with a system Chromium (no playwright install) point here.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    // PORT drives the dev script's --port, so there is only ever one port flag.
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: E2E_PORT,
      MY_ASSIST_PROVIDER: 'fake',
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ??
        'postgres://postgres:postgres@127.0.0.1:5544/my_assist_test',
    },
  },
});

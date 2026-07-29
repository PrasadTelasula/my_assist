import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    // Environments with a system Chromium (no playwright install) point here.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      MY_ASSIST_PROVIDER: 'fake',
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ??
        'postgres://postgres:postgres@127.0.0.1:5433/my_assist_test',
    },
  },
});

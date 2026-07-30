import { loadEnv } from './load-env';

/**
 * Prepares the *test* database for Playwright: the same migrate + seed the dev
 * database gets, but pointed at DATABASE_URL_TEST with the fake provider so the
 * Demo agent exists. Needed because `npm test` truncates those tables.
 */
async function main(): Promise<void> {
  loadEnv();
  const testUrl =
    process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@127.0.0.1:5544/my_assist_test';
  process.env.DATABASE_URL = testUrl;
  process.env.MY_ASSIST_PROVIDER = 'fake';

  // Imported after the env is set: the db client reads DATABASE_URL on load.
  const { runMigrations } = await import('./migrate');
  const { seed } = await import('./seed');
  await runMigrations(testUrl);
  await seed();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

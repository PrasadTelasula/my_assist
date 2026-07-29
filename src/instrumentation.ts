/**
 * Next.js server-startup hook: any run marked running in the DB at boot
 * belongs to a previous server process and can never finish — fail it fast
 * so the UI shows the truth instead of a forever-spinner.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.MY_ASSIST_PROVIDER === 'fake') {
    const { registerDemoFakeModel } = await import('@/server/fake-model');
    registerDemoFakeModel();
  }
  const { runManager } = await import('@/server/runs/run-manager');
  await runManager.sweepOrphanRuns();
}

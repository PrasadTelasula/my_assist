import { runManager } from '@/server/runs/run-manager';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const aborted = runManager.abortRun(id);
  if (!aborted) return Response.json({ error: 'Run is not active' }, { status: 409 });
  return Response.json({ ok: true });
}

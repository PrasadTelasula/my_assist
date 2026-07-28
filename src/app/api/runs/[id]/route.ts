import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { runs } from '@/server/db/schema';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await db.query.runs.findFirst({ where: eq(runs.id, id) });
  if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
  return Response.json(run);
}

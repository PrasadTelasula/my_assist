import { desc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { tools, toolVersions } from '@/server/db/schema';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tool = await db.query.tools.findFirst({ where: eq(tools.id, id) });
  if (!tool) return Response.json({ error: 'Tool not found' }, { status: 404 });
  const versions = await db.query.toolVersions.findMany({
    where: eq(toolVersions.toolId, id),
    orderBy: desc(toolVersions.version),
  });
  return Response.json({ ...tool, versions });
}

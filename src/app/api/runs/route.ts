import { desc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { agents, runs } from '@/server/db/schema';

export async function GET() {
  const rows = await db
    .select({
      id: runs.id,
      trigger: runs.trigger,
      status: runs.status,
      inputText: runs.inputText,
      iterations: runs.iterations,
      totalInputTokens: runs.totalInputTokens,
      totalOutputTokens: runs.totalOutputTokens,
      totalCostUsd: runs.totalCostUsd,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
      agentName: agents.name,
    })
    .from(runs)
    .innerJoin(agents, eq(runs.agentId, agents.id))
    .orderBy(desc(runs.startedAt))
    .limit(100);
  return Response.json(rows);
}

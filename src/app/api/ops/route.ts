import { count, desc, eq, sql, sum } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { agents, runs } from '@/server/db/schema';

const PROVIDER_ENV: [string, string][] = [
  ['anthropic', 'ANTHROPIC_API_KEY'],
  ['openai', 'OPENAI_API_KEY'],
  ['google', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  ['openrouter', 'OPENROUTER_API_KEY'],
];

export async function GET() {
  const byAgent = await db
    .select({
      agentId: agents.id,
      agentName: agents.name,
      runCount: count(runs.id),
      failures: sql<number>`count(*) filter (where ${runs.status} = 'failed')`.mapWith(Number),
      inputTokens: sum(runs.totalInputTokens).mapWith(Number),
      outputTokens: sum(runs.totalOutputTokens).mapWith(Number),
      costUsd: sum(runs.totalCostUsd).mapWith(Number),
    })
    .from(runs)
    .innerJoin(agents, eq(runs.agentId, agents.id))
    .groupBy(agents.id, agents.name)
    .orderBy(desc(sum(runs.totalCostUsd)));

  const recentFailures = await db
    .select({
      id: runs.id,
      agentName: agents.name,
      trigger: runs.trigger,
      error: runs.error,
      startedAt: runs.startedAt,
    })
    .from(runs)
    .innerJoin(agents, eq(runs.agentId, agents.id))
    .where(eq(runs.status, 'failed'))
    .orderBy(desc(runs.startedAt))
    .limit(10);

  const [active] = await db.select({ count: count() }).from(runs).where(eq(runs.status, 'running'));

  return Response.json({
    byAgent,
    recentFailures,
    activeRuns: active?.count ?? 0,
    providers: PROVIDER_ENV.map(([provider, env]) => ({
      provider,
      configured: Boolean(process.env[env]),
    })),
  });
}

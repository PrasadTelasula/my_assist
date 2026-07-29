import { z } from 'zod';

import { planSprintFromGoal } from '@/server/planner';

const planSchema = z.object({
  goal: z.string().min(1).max(5000),
  agentId: z.uuid(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  const started = await planSprintFromGoal(id, parsed.data.goal, parsed.data.agentId);
  if (!started) return Response.json({ error: 'Sprint or agent not found' }, { status: 404 });
  return Response.json({ runId: started.runId }, { status: 202 });
}

import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { updateTask } from '@/server/board';
import { db } from '@/server/db/client';
import { runs, tasks } from '@/server/db/schema';
import { assignAgentToTask } from '@/server/task-runs';

const patchTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(20_000).optional(),
  points: z.number().int().min(0).max(100).nullable().optional(),
  status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional(),
  sortOrder: z.number().optional(),
  sprintId: z.uuid().nullable().optional(),
  assigneeUserId: z.uuid().nullable().optional(),
  assigneeAgentId: z.uuid().nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
  const latestRun = await db.query.runs.findFirst({
    where: eq(runs.taskId, id),
    orderBy: desc(runs.startedAt),
  });
  return Response.json({ ...task, latestRunId: latestRun?.id ?? null });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = patchTaskSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });

  // Assigning an agent is the "go work this" gesture — it starts a run.
  if (parsed.data.assigneeAgentId) {
    const started = await assignAgentToTask(id, parsed.data.assigneeAgentId);
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
    return Response.json({ ...task, runId: started?.runId ?? null });
  }

  const task = await updateTask(id, parsed.data);
  if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
  return Response.json({ ...task, runId: null });
}

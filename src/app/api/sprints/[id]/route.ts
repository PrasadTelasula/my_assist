import { z } from 'zod';

import { updateSprint } from '@/server/board';

const patchSprintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(500).optional(),
  criticAgentId: z.uuid().nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = patchSprintSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  const sprint = await updateSprint(id, parsed.data);
  if (!sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });
  return Response.json(sprint);
}

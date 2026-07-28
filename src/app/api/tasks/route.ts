import { z } from 'zod';

import { createTask, listTasks } from '@/server/board';

const createTaskSchema = z.object({
  sprintId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).optional(),
  points: z.number().int().min(0).max(100).nullable().optional(),
});

export async function GET(request: Request) {
  const sprintId = new URL(request.url).searchParams.get('sprintId') ?? undefined;
  return Response.json(await listTasks(sprintId));
}

export async function POST(request: Request) {
  const parsed = createTaskSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  return Response.json(await createTask(parsed.data), { status: 201 });
}

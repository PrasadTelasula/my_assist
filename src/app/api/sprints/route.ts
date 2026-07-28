import { z } from 'zod';

import { createSprint, listSprints } from '@/server/board';

const createSprintSchema = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(500).optional(),
  criticAgentId: z.uuid().nullable().optional(),
});

export async function GET() {
  return Response.json(await listSprints());
}

export async function POST(request: Request) {
  const parsed = createSprintSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  return Response.json(await createSprint(parsed.data), { status: 201 });
}

import { z } from 'zod';

import { addComment, listTaskActivity } from '@/server/board';
import { getCurrentUser } from '@/server/db/seed-user';

const commentSchema = z.object({ body: z.string().min(1).max(10_000) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return Response.json(await listTaskActivity(id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = commentSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  const user = await getCurrentUser();
  return Response.json(await addComment(id, parsed.data.body, user.id), { status: 201 });
}

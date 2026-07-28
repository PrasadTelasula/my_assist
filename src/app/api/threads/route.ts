import { createThread, listThreads } from '@/server/chat';
import { createThreadSchema } from '@/lib/schemas';

export async function GET() {
  return Response.json(await listThreads());
}

export async function POST(request: Request) {
  const parsed = createThreadSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  return Response.json(await createThread(parsed.data), { status: 201 });
}

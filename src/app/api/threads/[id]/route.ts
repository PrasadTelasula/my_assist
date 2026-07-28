import { getThreadWithMessages } from '@/server/chat';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const thread = await getThreadWithMessages(id);
  if (!thread) return Response.json({ error: 'Thread not found' }, { status: 404 });
  return Response.json(thread);
}

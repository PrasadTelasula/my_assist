import { postUserMessage } from '@/server/chat';
import { postMessageSchema } from '@/lib/schemas';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = postMessageSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });

  const { runId } = await postUserMessage({ threadId: id, text: parsed.data.text });
  return Response.json({ runId }, { status: 202 });
}

import { z } from 'zod';

import { setAgentTools } from '@/server/agents';

const setToolsSchema = z.object({ toolIds: z.array(z.uuid()) });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = setToolsSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  await setAgentTools(id, parsed.data.toolIds);
  return Response.json({ ok: true });
}

import { z } from 'zod';

import { testRunTool } from '@/server/tools';

const testRunSchema = z.object({ args: z.unknown() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = testRunSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  return Response.json(await testRunTool(id, parsed.data.args));
}

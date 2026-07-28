import { z } from 'zod';

import { saveToolVersion, ToolValidationError } from '@/server/tools';

const saveVersionSchema = z.object({
  tsCode: z.string().min(1).max(100_000),
  permissions: z.object({ net: z.boolean() }).default({ net: false }),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = saveVersionSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  try {
    return Response.json(await saveToolVersion(id, parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof ToolValidationError) {
      return Response.json({ error: err.message, issues: err.issues }, { status: 422 });
    }
    throw err;
  }
}

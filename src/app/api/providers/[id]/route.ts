import { z } from 'zod';

import { PROVIDER_KINDS, TOOL_MODES } from '@/server/db/schema';
import { ConnectionInUseError, deleteConnection, updateConnection } from '@/server/providers';

const patchConnectionSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  kind: z.enum(PROVIDER_KINDS).optional(),
  baseUrl: z.url().nullable().optional(),
  apiKey: z.string().max(500).nullable().optional(),
  toolMode: z.enum(TOOL_MODES).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = patchConnectionSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  const updated = await updateConnection(id, parsed.data);
  if (!updated) return Response.json({ error: 'Connection not found' }, { status: 404 });
  const { apiKey, ...rest } = updated;
  return Response.json({ ...rest, hasApiKey: Boolean(apiKey) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await deleteConnection(id);
  } catch (err) {
    if (err instanceof ConnectionInUseError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
  return Response.json({ ok: true });
}

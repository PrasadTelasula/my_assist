import { z } from 'zod';

import { PROVIDER_KINDS, TOOL_MODES } from '@/server/db/schema';
import { createConnection, listConnections } from '@/server/providers';

const createConnectionSchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(PROVIDER_KINDS),
  baseUrl: z.url().nullable().optional(),
  apiKey: z.string().max(500).nullable().optional(),
  toolMode: z.enum(TOOL_MODES).optional(),
});

export async function GET() {
  const rows = await listConnections();
  // Never ship secrets to the browser — only whether one is set.
  return Response.json(
    rows.map(({ apiKey, ...rest }) => ({ ...rest, hasApiKey: Boolean(apiKey) })),
  );
}

export async function POST(request: Request) {
  const parsed = createConnectionSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  const { apiKey, ...created } = await createConnection(parsed.data);
  return Response.json({ ...created, hasApiKey: Boolean(apiKey) }, { status: 201 });
}

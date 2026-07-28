import { z } from 'zod';

import { db } from '@/server/db/client';
import { createTool, ToolValidationError } from '@/server/tools';

const createToolSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'snake_case name required'),
  description: z.string().min(1).max(500),
  tsCode: z.string().min(1).max(100_000),
  permissions: z.object({ net: z.boolean() }).default({ net: false }),
});

export async function GET() {
  const rows = await db.query.tools.findMany();
  return Response.json(rows);
}

export async function POST(request: Request) {
  const parsed = createToolSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  try {
    return Response.json(await createTool(parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof ToolValidationError) {
      return Response.json({ error: err.message, issues: err.issues }, { status: 422 });
    }
    throw err;
  }
}

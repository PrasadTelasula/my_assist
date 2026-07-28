import { z } from 'zod';

import { getAgentWithTools, updateAgent } from '@/server/agents';

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(50_000).optional(),
  modelProvider: z
    .enum(['anthropic', 'openai', 'google', 'openrouter', 'ollama', 'fake'])
    .optional(),
  modelId: z.string().min(1).max(100).optional(),
  maxIterations: z.number().int().min(1).max(100).optional(),
  costCeilingUsd: z.number().positive().max(1000).optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgentWithTools(id);
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });
  return Response.json(agent);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = updateAgentSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  const agent = await updateAgent(id, parsed.data);
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });
  return Response.json(agent);
}

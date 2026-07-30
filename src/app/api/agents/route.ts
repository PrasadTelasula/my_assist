import { z } from 'zod';

import { createAgent, listAgents } from '@/server/agents';

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  systemPrompt: z.string().min(1).max(50_000),
  modelProvider: z.enum([
    'anthropic',
    'openai',
    'google',
    'openrouter',
    'ollama',
    'openai-compatible',
    'fake',
  ]),
  modelId: z.string().min(1).max(100),
  maxIterations: z.number().int().min(1).max(100).optional(),
  costCeilingUsd: z.number().positive().max(1000).optional(),
  providerConnectionId: z.uuid().nullable().optional(),
});

export async function GET() {
  return Response.json(await listAgents());
}

export async function POST(request: Request) {
  const parsed = createAgentSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422 });
  return Response.json(await createAgent(parsed.data), { status: 201 });
}

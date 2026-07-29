import { eq } from 'drizzle-orm';

import { type Agent, agents, agentTools } from '@/server/db/schema';
import { db } from '@/server/db/client';

interface AgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  modelProvider: string;
  modelId: string;
  maxIterations?: number;
  costCeilingUsd?: number;
  providerConnectionId?: string | null;
}

export async function createAgent(input: AgentInput): Promise<Agent> {
  const [agent] = await db
    .insert(agents)
    .values({
      ...input,
      costCeilingUsd: input.costCeilingUsd?.toString() ?? '1.0',
    })
    .returning();
  return agent!;
}

export async function updateAgent(id: string, input: Partial<AgentInput>): Promise<Agent | null> {
  const [agent] = await db
    .update(agents)
    .set({
      ...input,
      costCeilingUsd: input.costCeilingUsd?.toString(),
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id))
    .returning();
  return agent ?? null;
}

export async function getAgentWithTools(id: string) {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, id) });
  if (!agent) return null;
  const attached = await db.query.agentTools.findMany({ where: eq(agentTools.agentId, id) });
  return { ...agent, toolIds: attached.map((row) => row.toolId) };
}

/** Replaces the agent's tool set atomically. */
export async function setAgentTools(agentId: string, toolIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(agentTools).where(eq(agentTools.agentId, agentId));
    if (toolIds.length > 0) {
      await tx.insert(agentTools).values(toolIds.map((toolId) => ({ agentId, toolId })));
    }
  });
}

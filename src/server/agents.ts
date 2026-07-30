import { asc, count, eq } from 'drizzle-orm';

import { type Agent, agents, agentTools, providerConnections } from '@/server/db/schema';
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

/**
 * The agent list carries `toolCount` because "why didn't it call my tool?" is
 * almost always "it has none", and that has to be answerable at a glance.
 */
export async function listAgents() {
  return db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      modelProvider: agents.modelProvider,
      modelId: agents.modelId,
      providerConnectionId: agents.providerConnectionId,
      connectionName: providerConnections.name,
      toolCount: count(agentTools.toolId),
    })
    .from(agents)
    .leftJoin(providerConnections, eq(agents.providerConnectionId, providerConnections.id))
    .leftJoin(agentTools, eq(agentTools.agentId, agents.id))
    .groupBy(agents.id, providerConnections.name)
    .orderBy(asc(agents.name));
}

/** Agent names are unique; a clash is a user mistake, not a server fault. */
export class NameTakenError extends Error {
  constructor(name: string) {
    super(`An agent named "${name}" already exists. Pick a different name.`);
    this.name = 'NameTakenError';
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'cause' in err
    ? (err.cause as { code?: string } | undefined)?.code === '23505'
    : false;
}

export async function createAgent(input: AgentInput): Promise<Agent> {
  try {
    const [agent] = await db
      .insert(agents)
      .values({
        ...input,
        costCeilingUsd: input.costCeilingUsd?.toString() ?? '1.0',
      })
      .returning();
    return agent!;
  } catch (err) {
    if (isUniqueViolation(err)) throw new NameTakenError(input.name);
    throw err;
  }
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

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createAgent,
  getAgentWithTools,
  listAgents,
  setAgentTools,
  updateAgent,
} from '@/server/agents';
import { db } from '@/server/db/client';
import { agents, agentTools, tools, toolVersions } from '@/server/db/schema';
import { createTool } from '@/server/tools';

const TOOL = `
export const schema = { type: 'object', properties: {} };
export default async function run() { return 'ok'; }
`;

describe('agents', () => {
  beforeEach(async () => {
    await db.delete(agentTools);
    await db.delete(toolVersions);
    await db.delete(tools);
  });

  it('creates and updates an agent', async () => {
    const agent = await createAgent({
      name: 'Writer',
      systemPrompt: 'Write well.',
      modelProvider: 'anthropic',
      modelId: 'claude-sonnet-5',
      costCeilingUsd: 2.5,
    });
    expect(Number(agent.costCeilingUsd)).toBe(2.5);

    const updated = await updateAgent(agent.id, { systemPrompt: 'Write better.' });
    expect(updated!.systemPrompt).toBe('Write better.');
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(agent.updatedAt.getTime());

    await db.delete(agents).where(eq(agents.id, agent.id));
  });

  it('replaces the attached tool set atomically', async () => {
    const agent = await createAgent({
      name: 'Tooler',
      systemPrompt: 's',
      modelProvider: 'fake',
      modelId: 'scripted',
    });
    const toolA = await createTool({
      name: 'tool_a',
      description: 'a',
      tsCode: TOOL,
      permissions: { net: false },
    });
    const toolB = await createTool({
      name: 'tool_b',
      description: 'b',
      tsCode: TOOL,
      permissions: { net: false },
    });

    await setAgentTools(agent.id, [toolA.id, toolB.id]);
    expect((await getAgentWithTools(agent.id))!.toolIds.toSorted()).toEqual(
      [toolA.id, toolB.id].toSorted(),
    );

    await setAgentTools(agent.id, [toolB.id]);
    expect((await getAgentWithTools(agent.id))!.toolIds).toEqual([toolB.id]);

    await db.delete(agentTools).where(eq(agentTools.agentId, agent.id));
    await db.delete(agents).where(eq(agents.id, agent.id));
  });

  it('reports how many tools each agent carries, so a toolless agent is obvious', async () => {
    const armed = await createAgent({
      name: 'Armed',
      systemPrompt: 's',
      modelProvider: 'fake',
      modelId: 'scripted',
    });
    await createAgent({
      name: 'Bare',
      systemPrompt: 's',
      modelProvider: 'fake',
      modelId: 'scripted',
    });
    const tool = await createTool({
      name: 'tool_c',
      description: 'c',
      tsCode: TOOL,
      permissions: { net: false },
    });
    await setAgentTools(armed.id, [tool.id]);

    const listed = await listAgents();
    const mine = listed.filter((a) => a.name === 'Armed' || a.name === 'Bare');
    expect(mine.map((a) => [a.name, a.toolCount])).toEqual([
      ['Armed', 1],
      ['Bare', 0],
    ]);

    await db.delete(agentTools).where(eq(agentTools.agentId, armed.id));
    await db.delete(agents).where(eq(agents.name, 'Armed'));
    await db.delete(agents).where(eq(agents.name, 'Bare'));
  });
});

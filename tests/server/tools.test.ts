import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { registerFakeModel } from '@/core/model-registry';
import { createThread, postUserMessage } from '@/server/chat';
import { db } from '@/server/db/client';
import {
  agents,
  agentTools,
  messages,
  runEvents,
  runs,
  tools,
  toolVersions,
} from '@/server/db/schema';
import { createTool, saveToolVersion, testRunTool } from '@/server/tools';

import { resetDomainTables } from '../fixtures/reset-db';
import { scriptedModel } from '../fixtures/scripted-model';

const SHOUT_TOOL = `
export const schema = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
};

export default async function run(input: { text: string }) {
  return { shouted: input.text.toUpperCase() + '!' };
}
`;

describe('tools', () => {
  beforeEach(async () => {
    await resetDomainTables();
  });

  it('creates a tool with an extracted schema and version 1', async () => {
    const tool = await createTool({
      name: 'shout',
      description: 'Shout text back',
      tsCode: SHOUT_TOOL,
      permissions: { net: false },
    });

    expect(tool.latestVersion.version).toBe(1);
    expect(tool.latestVersion.inputSchema).toMatchObject({ type: 'object', required: ['text'] });

    const row = await db.query.tools.findFirst({ where: eq(tools.id, tool.id) });
    expect(row!.latestVersionId).toBe(tool.latestVersion.id);
  });

  it('rejects invalid tool code with line diagnostics instead of saving', async () => {
    await expect(
      createTool({
        name: 'evil',
        description: 'nope',
        tsCode: `import fs from 'fs';\n${SHOUT_TOOL}`,
        permissions: { net: false },
      }),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ line: 1 })],
    });
    expect(await db.query.tools.findMany()).toHaveLength(0);
  });

  it('saves new versions and moves the latest pointer', async () => {
    const tool = await createTool({
      name: 'shout',
      description: 'Shout text back',
      tsCode: SHOUT_TOOL,
      permissions: { net: false },
    });
    const v2 = await saveToolVersion(tool.id, {
      tsCode: SHOUT_TOOL.replace("+ '!'", "+ '!!!'"),
      permissions: { net: false },
    });

    expect(v2.version).toBe(2);
    const row = await db.query.tools.findFirst({ where: eq(tools.id, tool.id) });
    expect(row!.latestVersionId).toBe(v2.id);
  });

  it('test-runs a tool in the sandbox', async () => {
    const tool = await createTool({
      name: 'shout',
      description: 'Shout text back',
      tsCode: SHOUT_TOOL,
      permissions: { net: false },
    });
    const result = await testRunTool(tool.id, { text: 'hey' });
    expect(result.ok).toBe(true);
    expect(result.result).toEqual({ shouted: 'HEY!' });
  });

  it('exposes attached user tools to agent runs, pinned at run start', async () => {
    const tool = await createTool({
      name: 'shout',
      description: 'Shout text back',
      tsCode: SHOUT_TOOL,
      permissions: { net: false },
    });
    const [agent] = await db
      .insert(agents)
      .values({ name: 'F', systemPrompt: 's', modelProvider: 'fake', modelId: 'scripted' })
      .returning();
    await db.insert(agentTools).values({ agentId: agent!.id, toolId: tool.id });

    registerFakeModel(() =>
      scriptedModel([
        { toolCalls: [{ toolName: 'shout', input: { text: 'go' } }] },
        { text: 'done' },
      ]),
    );
    const thread = await createThread({ agentId: agent!.id, title: 't' });
    const { runId, done } = await postUserMessage({ threadId: thread.id, text: 'shout go' });
    await done;

    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    expect(run!.status).toBe('succeeded');
    expect(run!.pinned.tools).toContainEqual({
      name: 'shout',
      toolVersionId: tool.latestVersion.id,
    });

    const events = await db.query.runEvents.findMany({ where: eq(runEvents.runId, runId) });
    const toolResult = events.find((e) => e.type === 'tool_result');
    expect(toolResult!.payload).toMatchObject({ output: { shouted: 'GO!' }, isError: false });
  });
});

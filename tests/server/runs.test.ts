import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { registerFakeModel } from '@/core/model-registry';
import { db } from '@/server/db/client';
import { agents, messages, runs } from '@/server/db/schema';
import { setAgentTools } from '@/server/agents';
import { createThread, postUserMessage } from '@/server/chat';
import { listRunEventsAfter } from '@/server/runs/event-store';
import { runManager } from '@/server/runs/run-manager';
import { createTool } from '@/server/tools';

import { resetDomainTables } from '../fixtures/reset-db';
import { scriptedModel } from '../fixtures/scripted-model';

async function fakeAgent() {
  const [agent] = await db
    .insert(agents)
    .values({
      name: 'Fake',
      systemPrompt: 'test prompt',
      modelProvider: 'fake',
      modelId: 'scripted',
    })
    .returning();
  return agent!;
}

const ECHO_TOOL = `
export const schema = { type: 'object', properties: {}, required: [] };
export default async function run() {
  return { at: 'noon' };
}
`;

describe('chat runs', () => {
  beforeEach(async () => {
    await resetDomainTables();
  });

  it('persists a completed run with contiguous events and the assistant reply', async () => {
    registerFakeModel(() =>
      scriptedModel([
        { text: 'Checking.', toolCalls: [{ toolName: 'get_time', input: {} }] },
        { text: 'All done.', inputTokens: 30, outputTokens: 9 },
      ]),
    );
    const agent = await fakeAgent();
    const thread = await createThread({ agentId: agent.id, title: 'test' });

    const { runId, done } = await postUserMessage({
      threadId: thread.id,
      text: 'what time is it?',
    });
    await done;

    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    expect(run!.status).toBe('succeeded');
    expect(run!.finalText).toBe('All done.');
    expect(run!.iterations).toBe(2);
    expect(run!.totalOutputTokens).toBeGreaterThan(0);
    expect(run!.pinned.model).toEqual({ provider: 'fake', modelId: 'scripted' });

    const events = await listRunEventsAfter(runId, 0);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('run_started');
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types[types.length - 1]).toBe('run_finished');

    const stored = await db.query.messages.findMany({
      where: eq(messages.threadId, thread.id),
      orderBy: (m, { asc }) => asc(m.createdAt),
    });
    expect(stored.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(stored[1]!.content).toBe('All done.');
    expect(stored[1]!.runId).toBe(runId);
  });

  it('records which tools a run could reach, whether or not it used them', async () => {
    // A run that never calls a tool is otherwise indistinguishable in the
    // trace from a run that had none to call.
    registerFakeModel(() => scriptedModel([{ text: 'No tool needed.', toolCalls: [] }]));

    const bare = await fakeAgent();
    const bareRun = await postUserMessage({
      threadId: (await createThread({ agentId: bare.id, title: 'bare' })).id,
      text: 'hello',
    });
    await bareRun.done;
    const [bareStart] = await listRunEventsAfter(bareRun.runId, 0);
    expect(bareStart!.payload).toMatchObject({ tools: [] });

    const tool = await createTool({
      name: 'clock',
      description: 'Tells the time',
      tsCode: ECHO_TOOL,
      permissions: { net: false },
    });
    const equipped = await db
      .insert(agents)
      .values({
        name: 'Equipped',
        systemPrompt: 'test prompt',
        modelProvider: 'fake',
        modelId: 'scripted',
      })
      .returning();
    await setAgentTools(equipped[0]!.id, [tool.id]);

    const armed = await postUserMessage({
      threadId: (await createThread({ agentId: equipped[0]!.id, title: 'armed' })).id,
      text: 'hello',
    });
    await armed.done;
    const [armedStart] = await listRunEventsAfter(armed.runId, 0);
    expect(armedStart!.payload).toMatchObject({ tools: ['clock'] });
  });

  it('marks a run failed when the model errors', async () => {
    registerFakeModel(() => scriptedModel([]));
    const agent = await fakeAgent();
    const thread = await createThread({ agentId: agent.id, title: 'boom' });

    const { runId, done } = await postUserMessage({ threadId: thread.id, text: 'hi' });
    await done;

    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    expect(run!.status).toBe('failed');
    expect(run!.error).toMatch(/exhausted/);
  });

  it('replays SSE events after Last-Event-ID without gaps or duplicates', async () => {
    registerFakeModel(() => scriptedModel([{ text: 'quick reply' }]));
    const agent = await fakeAgent();
    const thread = await createThread({ agentId: agent.id, title: 'sse' });
    const { runId, done } = await postUserMessage({ threadId: thread.id, text: 'hi' });
    await done;

    const { GET } = await import('@/app/api/runs/[id]/events/route');
    const request = new Request(`http://test/api/runs/${runId}/events`, {
      headers: { 'last-event-id': '1' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: runId }) });
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const body = await new Response(response.body).text();
    const seqs = [...body.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));
    expect(seqs.length).toBeGreaterThan(0);
    expect(seqs[0]).toBe(2); // replay starts after Last-Event-ID
    expect(seqs).toEqual([...new Set(seqs)].sort((a, b) => a - b));
    expect(body).toContain('event: done');
  });

  it('sweeps orphaned running runs to failed on startup', async () => {
    const agent = await fakeAgent();
    const [orphan] = await db
      .insert(runs)
      .values({
        agentId: agent.id,
        trigger: 'chat',
        status: 'running',
        pinned: { systemPrompt: 'x', model: { provider: 'fake', modelId: 's' }, tools: [] },
        inputText: 'orphaned',
      })
      .returning();

    await runManager.sweepOrphanRuns();

    const swept = await db.query.runs.findFirst({ where: eq(runs.id, orphan!.id) });
    expect(swept!.status).toBe('failed');
    expect(swept!.error).toMatch(/orphan/i);
  });
});

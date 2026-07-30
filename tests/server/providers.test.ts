import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAgent } from '@/server/agents';
import { db } from '@/server/db/client';
import { agents, providerConnections } from '@/server/db/schema';
import {
  createConnection,
  listConnections,
  probeConnection,
  resolveAgentModel,
} from '@/server/providers';

import { resetDomainTables } from '../fixtures/reset-db';

describe('provider connections', () => {
  beforeEach(async () => {
    await resetDomainTables();
    await db.delete(providerConnections);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stores a local OpenAI-compatible endpoint', async () => {
    const connection = await createConnection({
      name: 'apfel-local',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: null,
    });

    expect(connection.kind).toBe('openai-compatible');
    expect(await listConnections()).toHaveLength(1);
  });

  it('discovers models by probing /models in the OpenAI shape', async () => {
    const connection = await createConnection({
      name: 'apfel',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
    });
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return Response.json({ data: [{ id: 'apple-foundationmodel' }, { id: 'other' }] });
    });

    const probe = await probeConnection(connection.id);

    expect(probe).toMatchObject({ ok: true, models: ['apple-foundationmodel', 'other'] });
    expect(calls[0]![0]).toBe('http://127.0.0.1:11434/v1/models');
  });

  it('confirms tool calling when the endpoint returns a tool_call, forcing the choice', async () => {
    const connection = await createConnection({
      name: 'capable',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
    });
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.endsWith('/models')) return Response.json({ data: [{ id: 'm' }] });
      const body = JSON.parse(String(init!.body)) as { tools?: unknown[]; tool_choice?: unknown };
      expect(body.tools).toHaveLength(1);
      // Forced, so the answer reflects the server, not the model's mood.
      expect(body.tool_choice).toEqual({ type: 'function', function: { name: 'ping' } });
      return Response.json({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                { id: 'c', type: 'function', function: { name: 'ping', arguments: '{}' } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      });
    });

    const probe = await probeConnection(connection.id);
    expect(probe.toolCalling).toBe('yes');
  });

  it('records prose as "no-call" rather than claiming the server lacks support', async () => {
    const connection = await createConnection({
      name: 'toolless',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
    });
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/models')) return Response.json({ data: [{ id: 'm' }] });
      return Response.json({
        choices: [
          {
            message: { role: 'assistant', content: 'I cannot call tools.' },
            finish_reason: 'stop',
          },
        ],
      });
    });

    const probe = await probeConnection(connection.id);
    expect(probe.toolCalling).toBe('no-call');
  });

  it('carries the connection tool mode through to the run', async () => {
    const connection = await createConnection({
      name: 'prompted-endpoint',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      toolMode: 'prompted',
    });
    const [agent] = await db
      .insert(agents)
      .values({
        name: 'Prompted',
        systemPrompt: 's',
        modelProvider: 'openai-compatible',
        modelId: 'apple-foundationmodel',
        providerConnectionId: connection.id,
      })
      .returning();

    expect((await resolveAgentModel(agent!)).toolMode).toBe('prompted');
    await db.delete(agents).where(eq(agents.id, agent!.id));
  });

  it('leaves the tool verdict unknown when the endpoint cannot be reached at all', async () => {
    const connection = await createConnection({
      name: 'gone',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:1/v1',
    });
    vi.stubGlobal('fetch', async () => {
      throw new Error('connect ECONNREFUSED');
    });

    const probe = await probeConnection(connection.id);
    expect(probe.ok).toBe(false);
    expect(probe.toolCalling).toBe('unknown');
  });

  it('sends the token as a bearer header when one is configured', async () => {
    const connection = await createConnection({
      name: 'guarded',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:8080/v1',
      apiKey: 'secret-token',
    });
    const headers: Record<string, string>[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      headers.push(init.headers as Record<string, string>);
      return Response.json({ data: [] });
    });

    await probeConnection(connection.id);

    expect(headers[0]!.Authorization).toBe('Bearer secret-token');
  });

  it('reports an unreachable endpoint instead of throwing', async () => {
    const connection = await createConnection({
      name: 'down',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:9/v1',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    const probe = await probeConnection(connection.id);

    expect(probe.ok).toBe(false);
    expect(probe.error).toMatch(/Could not reach .*ECONNREFUSED/);
    expect(probe.models).toEqual([]);
  });

  it('resolves an agent through its connection, not the environment', async () => {
    const connection = await createConnection({
      name: 'apfel',
      kind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
    });
    const agent = await createAgent({
      name: 'Local',
      systemPrompt: 's',
      modelProvider: 'anthropic', // stale value: the connection kind must win
      modelId: 'apple-foundationmodel',
      providerConnectionId: connection.id,
    });

    const { modelRef, model } = await resolveAgentModel(agent);

    expect(modelRef).toEqual({
      provider: 'openai-compatible',
      modelId: 'apple-foundationmodel',
    });
    expect(model.modelId).toBe('apple-foundationmodel');

    await db.delete(agents).where(eq(agents.id, agent.id));
  });

  it('falls back to environment credentials when no connection is set', async () => {
    const agent = await createAgent({
      name: 'Hosted',
      systemPrompt: 's',
      modelProvider: 'anthropic',
      modelId: 'claude-sonnet-5',
    });

    const { modelRef } = await resolveAgentModel(agent);

    expect(modelRef).toEqual({ provider: 'anthropic', modelId: 'claude-sonnet-5' });
    await db.delete(agents).where(eq(agents.id, agent.id));
  });
});

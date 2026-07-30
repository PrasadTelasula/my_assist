import { asc, eq } from 'drizzle-orm';

import type { ModelRef } from '@/core/events';
import { resolveModel } from '@/core/model-registry';
import { db } from '@/server/db/client';
import { type Agent, type ProviderConnection, providerConnections } from '@/server/db/schema';

const ENV_KEYS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** Base URLs default to the conventional local ports when left blank. */
const DEFAULT_BASE_URLS: Record<string, string | undefined> = {
  ollama: process.env.OLLAMA_BASE_URL,
};

interface ConnectionInput {
  name: string;
  kind: ProviderConnection['kind'];
  baseUrl?: string | null;
  apiKey?: string | null;
  toolMode?: ProviderConnection['toolMode'];
}

export async function listConnections(): Promise<ProviderConnection[]> {
  return db.query.providerConnections.findMany({ orderBy: asc(providerConnections.name) });
}

export async function createConnection(input: ConnectionInput): Promise<ProviderConnection> {
  const [row] = await db.insert(providerConnections).values(input).returning();
  return row!;
}

export async function updateConnection(
  id: string,
  input: Partial<ConnectionInput>,
): Promise<ProviderConnection | null> {
  const [row] = await db
    .update(providerConnections)
    .set(input)
    .where(eq(providerConnections.id, id))
    .returning();
  return row ?? null;
}

export async function deleteConnection(id: string): Promise<void> {
  await db.delete(providerConnections).where(eq(providerConnections.id, id));
}

/**
 * 'yes' is definitive — a tool_call came back. 'no-call' is not: the endpoint
 * may ignore `tools`, or the model may simply have declined. Never report the
 * second as "unsupported"; a false accusation is worse than saying nothing.
 */
type ToolVerdict = ProviderConnection['toolCalling'];

interface ProbeResult {
  ok: boolean;
  models: string[];
  toolCalling: ToolVerdict;
  error?: string;
}

/**
 * Local OpenAI-compatible servers vary wildly in whether they implement the
 * `tools` parameter — many accept it and silently answer in prose. Attaching a
 * tool to an agent then looks broken, so ask the endpoint directly: offer it
 * one trivial function and see whether it comes back with a tool_call.
 */
async function probeToolSupport(
  baseUrl: string,
  apiKey: string | null,
  modelId: string,
): Promise<ToolVerdict> {
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 64,
        messages: [{ role: 'user', content: 'Call the ping tool. Reply with the tool call only.' }],
        // Forced choice, not 'auto': this asks whether the server implements
        // tools, and must not hinge on a small model deciding it wants one.
        tool_choice: { type: 'function', function: { name: 'ping' } },
        tools: [
          {
            type: 'function',
            function: {
              name: 'ping',
              description: 'Answers with pong. Call it whenever asked to ping.',
              parameters: { type: 'object', properties: {}, required: [] },
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return 'unknown';
    const body = (await response.json()) as {
      choices?: { message?: { tool_calls?: unknown[] } }[];
    };
    return body.choices?.[0]?.message?.tool_calls?.length ? 'yes' : 'no-call';
  } catch {
    return 'unknown';
  }
}

/**
 * Asks an endpoint what it can do: GET {baseUrl}/models in the OpenAI shape,
 * which local servers (apfel, Ollama, vLLM, LM Studio) all expose. Used by the
 * settings "Test" button and to populate the model picker.
 */
export async function probeConnection(id: string): Promise<ProbeResult> {
  const connection = await db.query.providerConnections.findFirst({
    where: eq(providerConnections.id, id),
  });
  if (!connection) {
    return { ok: false, models: [], toolCalling: 'unknown', error: 'Connection not found' };
  }
  if (!connection.baseUrl) {
    return {
      ok: false,
      models: [],
      toolCalling: 'unknown',
      error: 'This connection has no base URL to probe',
    };
  }

  const base = connection.baseUrl.replace(/\/$/, '');
  const url = `${base}/models`;
  try {
    const response = await fetch(url, {
      headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return {
        ok: false,
        models: [],
        toolCalling: 'unknown',
        error: `${url} responded ${response.status}`,
      };
    }
    const body = (await response.json()) as { data?: { id?: string }[] };
    const models = (body.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    const toolCalling: ToolVerdict = models[0]
      ? await probeToolSupport(base, connection.apiKey, models[0])
      : 'unknown';
    if (toolCalling !== 'unknown') {
      await db
        .update(providerConnections)
        .set({ toolCalling })
        .where(eq(providerConnections.id, id));
    }
    return { ok: true, models, toolCalling };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      models: [],
      toolCalling: 'unknown',
      error: `Could not reach ${url}: ${message}`,
    };
  }
}

/**
 * Resolves 'auto' to a real mode. The first run that actually has tools pays
 * for one probe; the verdict is cached on the connection so no later run does.
 * Without tools there is nothing to decide, so nothing is spent.
 */
async function effectiveToolMode(
  connection: ProviderConnection,
  hasTools: boolean,
): Promise<'native' | 'prompted'> {
  if (connection.toolMode !== 'auto') return connection.toolMode;
  if (!hasTools) return 'native';
  if (connection.toolCalling === 'unknown') await probeConnection(connection.id);
  const fresh = await db.query.providerConnections.findFirst({
    where: eq(providerConnections.id, connection.id),
  });
  // Only a definite "it would not call one" is worth the prompted tax.
  return fresh?.toolCalling === 'no-call' ? 'prompted' : 'native';
}

/**
 * Where an agent's credentials come from: its saved connection when it has
 * one, otherwise the environment for that provider kind.
 */
export async function resolveAgentModel(agent: Agent, opts: { hasTools?: boolean } = {}) {
  const connection = agent.providerConnectionId
    ? await db.query.providerConnections.findFirst({
        where: eq(providerConnections.id, agent.providerConnectionId),
      })
    : null;

  const provider = (connection?.kind ?? agent.modelProvider) as ModelRef['provider'];
  const modelRef: ModelRef = { provider, modelId: agent.modelId };
  const envKey = ENV_KEYS[provider];

  return {
    modelRef,
    toolMode: connection
      ? await effectiveToolMode(connection, opts.hasTools ?? false)
      : ('native' as const),
    model: resolveModel(modelRef, {
      apiKey: connection?.apiKey ?? (envKey ? process.env[envKey] : undefined),
      baseUrl: connection?.baseUrl ?? DEFAULT_BASE_URLS[provider],
    }),
  };
}

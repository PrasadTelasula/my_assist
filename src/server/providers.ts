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

interface ProbeResult {
  ok: boolean;
  models: string[];
  error?: string;
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
  if (!connection) return { ok: false, models: [], error: 'Connection not found' };
  if (!connection.baseUrl) {
    return { ok: false, models: [], error: 'This connection has no base URL to probe' };
  }

  const url = `${connection.baseUrl.replace(/\/$/, '')}/models`;
  try {
    const response = await fetch(url, {
      headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { ok: false, models: [], error: `${url} responded ${response.status}` };
    }
    const body = (await response.json()) as { data?: { id?: string }[] };
    const models = (body.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    return { ok: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, models: [], error: `Could not reach ${url}: ${message}` };
  }
}

/**
 * Where an agent's credentials come from: its saved connection when it has
 * one, otherwise the environment for that provider kind.
 */
export async function resolveAgentModel(agent: Agent) {
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
    model: resolveModel(modelRef, {
      apiKey: connection?.apiKey ?? (envKey ? process.env[envKey] : undefined),
      baseUrl: connection?.baseUrl ?? DEFAULT_BASE_URLS[provider],
    }),
  };
}

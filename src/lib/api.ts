interface ThreadListItem {
  id: string;
  title: string;
  createdAt: string;
  agentId: string;
  agentName: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  runId: string | null;
  createdAt: string;
}

interface ThreadDetail {
  id: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
}

interface RunListItem {
  id: string;
  trigger: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'aborted';
  inputText: string;
  iterations: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: string | null;
  startedAt: string;
  finishedAt: string | null;
  agentName: string;
}

interface AgentListItem {
  id: string;
  name: string;
  description: string;
  modelProvider: string;
  modelId: string;
}

interface AgentDetail extends AgentListItem {
  systemPrompt: string;
  maxIterations: number;
  costCeilingUsd: string;
  toolIds: string[];
}

interface AgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  modelProvider: string;
  modelId: string;
  maxIterations?: number;
  costCeilingUsd?: number;
}

interface ToolListItem {
  id: string;
  name: string;
  description: string;
  latestVersionId: string | null;
}

interface ToolVersionItem {
  id: string;
  version: number;
  tsCode: string;
  inputSchema: Record<string, unknown>;
  permissions: { net: boolean };
  createdAt: string;
}

interface ToolDetail extends ToolListItem {
  versions: ToolVersionItem[];
}

export interface ValidationIssue {
  message: string;
  line: number;
  column: number;
}

interface SandboxRunResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  stderr?: string;
}

export class ToolSaveError extends Error {
  constructor(
    message: string,
    public issues: ValidationIssue[],
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${init?.method ?? 'GET'} ${url} failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function requestToolSave<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      issues?: ValidationIssue[];
    } | null;
    throw new ToolSaveError(data?.error ?? `Save failed (${response.status})`, data?.issues ?? []);
  }
  return response.json() as Promise<T>;
}

export const api = {
  agents: {
    list: () => request<AgentListItem[]>('/api/agents'),
    get: (id: string) => request<AgentDetail>(`/api/agents/${id}`),
    create: (input: AgentInput) =>
      request<AgentDetail>('/api/agents', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: Partial<AgentInput>) =>
      request<AgentDetail>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    setTools: (id: string, toolIds: string[]) =>
      request<{ ok: boolean }>(`/api/agents/${id}/tools`, {
        method: 'PUT',
        body: JSON.stringify({ toolIds }),
      }),
  },
  tools: {
    list: () => request<ToolListItem[]>('/api/tools'),
    get: (id: string) => request<ToolDetail>(`/api/tools/${id}`),
    create: (input: {
      name: string;
      description: string;
      tsCode: string;
      permissions: { net: boolean };
    }) => requestToolSave<ToolDetail>('/api/tools', input),
    saveVersion: (id: string, input: { tsCode: string; permissions: { net: boolean } }) =>
      requestToolSave<ToolVersionItem>(`/api/tools/${id}/versions`, input),
    testRun: (id: string, args: unknown) =>
      request<SandboxRunResult>(`/api/tools/${id}/test-run`, {
        method: 'POST',
        body: JSON.stringify({ args }),
      }),
  },
  threads: {
    list: () => request<ThreadListItem[]>('/api/threads'),
    get: (id: string) => request<ThreadDetail>(`/api/threads/${id}`),
    create: (input: { agentId: string; title: string }) =>
      request<ThreadListItem>('/api/threads', { method: 'POST', body: JSON.stringify(input) }),
    postMessage: (threadId: string, text: string) =>
      request<{ runId: string }>(`/api/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
  },
  runs: {
    list: () => request<RunListItem[]>('/api/runs'),
  },
};

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

export const api = {
  agents: {
    list: () => request<AgentListItem[]>('/api/agents'),
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

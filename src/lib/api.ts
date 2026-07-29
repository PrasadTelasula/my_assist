import {
  ActivityItem,
  AgentDetail,
  AgentInput,
  AgentListItem,
  ConnectionInput,
  ConnectionItem,
  ProbeResult,
  RunListItem,
  SandboxRunResult,
  SprintItem,
  TaskItem,
  TaskPatchInput,
  ThreadDetail,
  ThreadListItem,
  ToolDetail,
  ToolListItem,
  ToolVersionItem,
  ValidationIssue,
} from './types';

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
  providers: {
    list: () => request<ConnectionItem[]>('/api/providers'),
    create: (input: ConnectionInput) =>
      request<ConnectionItem>('/api/providers', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: Partial<ConnectionInput>) =>
      request<ConnectionItem>(`/api/providers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    remove: (id: string) => request<{ ok: boolean }>(`/api/providers/${id}`, { method: 'DELETE' }),
    test: (id: string) => request<ProbeResult>(`/api/providers/${id}/test`, { method: 'POST' }),
  },
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
  sprints: {
    list: () => request<SprintItem[]>('/api/sprints'),
    create: (input: { name: string; goal?: string }) =>
      request<SprintItem>('/api/sprints', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: { criticAgentId?: string | null; goal?: string; name?: string }) =>
      request<SprintItem>(`/api/sprints/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    plan: (id: string, input: { goal: string; agentId: string }) =>
      request<{ runId: string }>(`/api/sprints/${id}/plan`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  },
  tasks: {
    list: (sprintId?: string) =>
      request<TaskItem[]>(`/api/tasks${sprintId ? `?sprintId=${sprintId}` : ''}`),
    get: (id: string) => request<TaskItem & { latestRunId: string | null }>(`/api/tasks/${id}`),
    create: (input: {
      sprintId?: string | null;
      title: string;
      description?: string;
      points?: number | null;
    }) => request<TaskItem>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
    patch: (id: string, input: TaskPatchInput) =>
      request<TaskItem & { runId: string | null }>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    activity: (id: string) => request<ActivityItem[]>(`/api/tasks/${id}/activity`),
    comment: (id: string, body: string) =>
      request<ActivityItem>(`/api/tasks/${id}/activity`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
  },
};

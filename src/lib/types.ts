export interface ThreadListItem {
  id: string;
  title: string;
  createdAt: string;
  agentId: string;
  agentName: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  runId: string | null;
  createdAt: string;
}

export interface ThreadDetail {
  id: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
}

export interface RunListItem {
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

export interface AgentListItem {
  id: string;
  name: string;
  description: string;
  modelProvider: string;
  modelId: string;
  providerConnectionId: string | null;
  /** Null when the agent uses environment credentials for its provider. */
  connectionName: string | null;
  toolCount: number;
}

export interface AgentDetail extends AgentListItem {
  systemPrompt: string;
  providerConnectionId: string | null;
  maxIterations: number;
  costCeilingUsd: string;
  toolIds: string[];
}

export interface AgentInput {
  name: string;
  providerConnectionId?: string | null;
  description?: string;
  systemPrompt: string;
  modelProvider: string;
  modelId: string;
  maxIterations?: number;
  costCeilingUsd?: number;
}

export interface ToolListItem {
  id: string;
  name: string;
  description: string;
  latestVersionId: string | null;
}

export interface ToolVersionItem {
  id: string;
  version: number;
  tsCode: string;
  inputSchema: Record<string, unknown>;
  permissions: { net: boolean };
  createdAt: string;
}

export interface ToolDetail extends ToolListItem {
  versions: ToolVersionItem[];
}

export interface ValidationIssue {
  message: string;
  line: number;
  column: number;
}

export interface SandboxRunResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  stderr?: string;
}

export interface SprintItem {
  id: string;
  name: string;
  goal: string;
  criticAgentId: string | null;
  createdAt: string;
}

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export interface TaskItem {
  id: string;
  sprintId: string | null;
  title: string;
  description: string;
  points: number | null;
  status: TaskStatus;
  sortOrder: string;
  assigneeUserId: string | null;
  assigneeAgentId: string | null;
  updatedAt: string;
}

export interface TaskPatchInput {
  title?: string;
  description?: string;
  points?: number | null;
  status?: TaskStatus;
  sprintId?: string | null;
  assigneeUserId?: string | null;
  assigneeAgentId?: string | null;
}

export interface ActivityItem {
  id: number;
  kind: 'comment' | 'status_change' | 'assignment' | 'agent_update' | 'blocked' | 'review';
  body: string;
  actorUserId: string | null;
  actorAgentId: string | null;
  runId: string | null;
  createdAt: string;
}

export const PROVIDER_KINDS = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'ollama',
  'openai-compatible',
] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const TOOL_MODES = ['native', 'prompted'] as const;
export type ToolMode = (typeof TOOL_MODES)[number];

export interface ConnectionItem {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string | null;
  hasApiKey: boolean;
  toolMode: ToolMode;
}

export interface ConnectionInput {
  name: string;
  kind: ProviderKind;
  baseUrl?: string | null;
  apiKey?: string | null;
  toolMode?: ToolMode;
}

export interface ProbeResult {
  ok: boolean;
  models: string[];
  /** 'yes' is proof; 'no-call' is a hint, not a verdict. */
  toolCalling: 'yes' | 'no-call' | 'unknown';
  error?: string;
}

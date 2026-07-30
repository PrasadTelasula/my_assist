import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { AgentEvent, ModelRef } from '@/core/events';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * How tools reach the model on a given endpoint. 'auto' resolves itself on
 * first use by asking the endpoint, and is the default so that attaching a
 * tool just works. See src/core/loop.ts for the two real modes.
 */
export const TOOL_MODES = ['auto', 'native', 'prompted'] as const;

/** Cached answer to "does this endpoint honour the tools parameter?". */
export const TOOL_VERDICTS = ['unknown', 'yes', 'no-call'] as const;

export const PROVIDER_KINDS = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'ollama',
  'openai-compatible',
] as const;

/**
 * A configured endpoint the platform can talk to — a hosted provider with a
 * key, or a local server ('openai-compatible': anything exposing
 * /v1/chat/completions, e.g. apfel, llama.cpp, vLLM, LM Studio).
 * Requests are made server-side, so the local server's CORS policy is moot.
 */
export const providerConnections = pgTable('provider_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  kind: text('kind', { enum: PROVIDER_KINDS }).notNull(),
  baseUrl: text('base_url'),
  // Local-first: stored as given. Encrypt-at-rest is a cloud TODO.
  apiKey: text('api_key'),
  // 'prompted' for endpoints that do not implement the `tools` parameter.
  toolMode: text('tool_mode', { enum: TOOL_MODES }).notNull().default('auto'),
  // What probing found, so 'auto' costs one request per connection, not per run.
  toolCalling: text('tool_calling', { enum: TOOL_VERDICTS }).notNull().default('unknown'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Unique so seeding is idempotent (onConflictDoNothing needs a constraint).
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  systemPrompt: text('system_prompt').notNull(),
  modelProvider: text('model_provider').notNull(),
  modelId: text('model_id').notNull(),
  // When set, credentials and base URL come from the connection instead of env.
  providerConnectionId: uuid('provider_connection_id').references(() => providerConnections.id),
  maxIterations: integer('max_iterations').notNull().default(20),
  costCeilingUsd: numeric('cost_ceiling_usd', { precision: 10, scale: 4 }).notNull().default('1.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface ToolPermissions {
  net: boolean;
}

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  // Nullable to break the insert cycle: tool row first, then version, then pointer.
  latestVersionId: uuid('latest_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const toolVersions = pgTable(
  'tool_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id),
    version: integer('version').notNull(),
    tsCode: text('ts_code').notNull(),
    compiledJs: text('compiled_js').notNull(),
    inputSchema: jsonb('input_schema').$type<Record<string, unknown>>().notNull(),
    permissions: jsonb('permissions').$type<ToolPermissions>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('tool_versions_tool_id_version_idx').on(table.toolId, table.version)],
);

export const agentTools = pgTable(
  'agent_tools',
  {
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id),
  },
  (table) => [uniqueIndex('agent_tools_agent_id_tool_id_idx').on(table.agentId, table.toolId)],
);

export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => threads.id),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  runId: uuid('run_id').references(() => runs.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface RunPinned {
  systemPrompt: string;
  model: ModelRef;
  tools: { name: string; toolVersionId: string | null }[];
}

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  threadId: uuid('thread_id').references(() => threads.id),
  taskId: uuid('task_id'),
  trigger: text('trigger', { enum: ['chat', 'task', 'manual', 'plan', 'critic'] }).notNull(),
  status: text('status', {
    enum: ['queued', 'running', 'succeeded', 'failed', 'aborted'],
  }).notNull(),
  pinned: jsonb('pinned').$type<RunPinned>().notNull(),
  inputText: text('input_text').notNull(),
  finalText: text('final_text'),
  error: text('error'),
  iterations: integer('iterations').notNull().default(0),
  totalInputTokens: integer('total_input_tokens').notNull().default(0),
  totalOutputTokens: integer('total_output_tokens').notNull().default(0),
  totalCostUsd: numeric('total_cost_usd', { precision: 10, scale: 6 }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const runEvents = pgTable(
  'run_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<AgentEvent>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('run_events_run_id_seq_idx').on(table.runId, table.seq)],
);

export const sprints = pgTable('sprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  goal: text('goal').notNull().default(''),
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  criticAgentId: uuid('critic_agent_id').references(() => agents.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sprintId: uuid('sprint_id').references(() => sprints.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    points: integer('points'),
    status: text('status', { enum: ['backlog', 'in_progress', 'review', 'done'] })
      .notNull()
      .default('backlog'),
    sortOrder: numeric('sort_order', { precision: 16, scale: 8 }).notNull().default('1000'),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id),
    assigneeAgentId: uuid('assignee_agent_id').references(() => agents.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'tasks_single_assignee_check',
      sql`${table.assigneeUserId} IS NULL OR ${table.assigneeAgentId} IS NULL`,
    ),
  ],
);

export const taskActivity = pgTable('task_activity', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id),
  kind: text('kind', {
    enum: ['comment', 'status_change', 'assignment', 'agent_update', 'blocked', 'review'],
  }).notNull(),
  body: text('body').notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorAgentId: uuid('actor_agent_id').references(() => agents.id),
  runId: uuid('run_id').references(() => runs.id),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type ProviderConnection = typeof providerConnections.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type ToolVersion = typeof toolVersions.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunEvent = typeof runEvents.$inferSelect;
export type Sprint = typeof sprints.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskActivity = typeof taskActivity.$inferSelect;

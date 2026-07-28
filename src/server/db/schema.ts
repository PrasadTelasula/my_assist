import {
  bigserial,
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

export const providerCredentials = pgTable('provider_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Matches src/core model-registry provider names ('anthropic' | 'openai' | ...).
  provider: text('provider').notNull().unique(),
  apiKey: text('api_key').notNull(),
  baseUrl: text('base_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  systemPrompt: text('system_prompt').notNull(),
  modelProvider: text('model_provider').notNull(),
  modelId: text('model_id').notNull(),
  maxIterations: integer('max_iterations').notNull().default(20),
  costCeilingUsd: numeric('cost_ceiling_usd', { precision: 10, scale: 4 }).notNull().default('1.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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

export type User = typeof users.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunEvent = typeof runEvents.$inferSelect;

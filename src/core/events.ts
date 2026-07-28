import { z } from 'zod';

export const modelRefSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'openrouter', 'ollama', 'fake']),
  modelId: z.string(),
});
export type ModelRef = z.infer<typeof modelRefSchema>;

const usageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
});
export type TokenUsage = z.infer<typeof usageSchema>;

const totalsSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  // null = at least one step had no pricing data; never guess money.
  costUsd: z.number().nullable(),
  wallMs: z.number(),
});
export type RunTotals = z.infer<typeof totalsSchema>;

export const agentEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('run_started'),
    model: modelRefSchema,
  }),
  z.object({
    type: z.literal('iteration_started'),
    iteration: z.number(),
  }),
  z.object({
    type: z.literal('model_response'),
    iteration: z.number(),
    text: z.string(),
    usage: usageSchema,
    costUsd: z.number().nullable(),
    latencyMs: z.number(),
    finishReason: z.string(),
  }),
  z.object({
    type: z.literal('tool_call'),
    iteration: z.number(),
    toolCallId: z.string(),
    toolName: z.string(),
    toolVersionId: z.string().nullable(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_result'),
    iteration: z.number(),
    toolCallId: z.string(),
    toolName: z.string(),
    output: z.unknown(),
    isError: z.boolean(),
    durationMs: z.number(),
  }),
  z.object({
    type: z.literal('run_finished'),
    iterations: z.number(),
    finalText: z.string(),
    totals: totalsSchema,
  }),
  z.object({
    type: z.literal('run_error'),
    reason: z.enum(['max_iterations', 'cost_ceiling', 'aborted', 'model_error']),
    message: z.string(),
    iteration: z.number(),
    totals: totalsSchema,
  }),
]);

export type AgentEvent = z.infer<typeof agentEventSchema>;

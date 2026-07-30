import { generateText, jsonSchema, tool } from 'ai';
import type { LanguageModel, ModelMessage, ToolSet } from 'ai';

import type { AgentEvent, ModelRef, RunTotals } from './events';
import { estimateCostUsd } from './pricing';
import { promptedTurn, toolManifest } from './prompted-tools';
import { makeDispatcher } from './tool-dispatch';

/**
 * 'native' sends the OpenAI/Anthropic `tools` parameter. 'prompted' describes
 * the tools in the system prompt and parses calls back out of the reply, for
 * endpoints that do not implement tool calling at all.
 */
export type ToolMode = 'native' | 'prompted';

export interface ToolExecutionResult {
  output: unknown;
  isError?: boolean;
}

export interface RuntimeTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's input (portable subset — see sandbox validation). */
  inputSchema: Record<string, unknown>;
  /** Pinned tool_versions id for user tools; null for built-ins. */
  toolVersionId: string | null;
  execute: (input: unknown) => Promise<ToolExecutionResult>;
}

export interface LoopOptions {
  model: LanguageModel;
  modelRef: ModelRef;
  system: string;
  messages: ModelMessage[];
  tools: RuntimeTool[];
  toolMode?: ToolMode;
  maxIterations?: number;
  costCeilingUsd?: number;
  signal?: AbortSignal;
}

/** Some servers reject a parameters object with no `required` key at all. */
function portableSchema(t: RuntimeTool): Record<string, unknown> {
  return 'required' in t.inputSchema ? t.inputSchema : { ...t.inputSchema, required: [] };
}

/**
 * The agent loop. This is the whole harness: ask the model, run the tools it
 * requests, feed results back, repeat until it answers — yielding a typed
 * event for everything it does. The AI SDK is used purely for provider
 * normalization; tools carry no `execute` so every dispatch happens here,
 * in plain sight.
 */
export async function* runAgentLoop(opts: LoopOptions): AsyncGenerator<AgentEvent> {
  const {
    model,
    modelRef,
    system,
    tools,
    toolMode = 'native',
    maxIterations = 20,
    costCeilingUsd = 1,
  } = opts;
  const messages = [...opts.messages];
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const prompted = toolMode === 'prompted' && tools.length > 0;
  // An agent with no tools is a plain conversation: send no tool list at all,
  // rather than an empty one that invites models to invent tool calls.
  const sdkTools: ToolSet | undefined =
    tools.length && !prompted
      ? Object.fromEntries(
          tools.map((t) => [
            t.name,
            tool({ description: t.description, inputSchema: jsonSchema(portableSchema(t)) }),
          ]),
        )
      : undefined;
  const systemPrompt = prompted ? `${system}\n\n${toolManifest(tools)}` : system;

  const dispatch = makeDispatcher(tools);

  const startedAt = performance.now();
  const totals: RunTotals = { inputTokens: 0, outputTokens: 0, costUsd: 0, wallMs: 0 };
  const totalsNow = (): RunTotals => ({
    ...totals,
    wallMs: Math.round(performance.now() - startedAt),
  });

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    yield { type: 'iteration_started', iteration };

    const t0 = performance.now();
    let res: Awaited<ReturnType<typeof generateText>>;
    try {
      res = await generateText({
        model,
        system: systemPrompt,
        messages,
        tools: sdkTools,
        abortSignal: opts.signal,
      });
    } catch (err) {
      yield {
        type: 'run_error',
        reason: opts.signal?.aborted ? 'aborted' : 'model_error',
        message: err instanceof Error ? err.message : String(err),
        iteration,
        totals: totalsNow(),
      };
      return;
    }

    const usage = {
      inputTokens: res.usage.inputTokens ?? 0,
      outputTokens: res.usage.outputTokens ?? 0,
    };
    const costUsd = estimateCostUsd(modelRef, usage);
    totals.inputTokens += usage.inputTokens;
    totals.outputTokens += usage.outputTokens;
    totals.costUsd = totals.costUsd === null || costUsd === null ? null : totals.costUsd + costUsd;

    yield {
      type: 'model_response',
      iteration,
      text: res.text,
      usage,
      costUsd,
      latencyMs: Math.round(performance.now() - t0),
      finishReason: res.finishReason,
    };

    messages.push(...res.response.messages);

    if (prompted) {
      const observation = yield* promptedTurn({ iteration, text: res.text, tools, dispatch });
      if (observation === null) {
        yield {
          type: 'run_finished',
          iterations: iteration + 1,
          finalText: res.text,
          totals: totalsNow(),
        };
        return;
      }
      messages.push({ role: 'user', content: observation });
      continue;
    }

    if (res.finishReason !== 'tool-calls') {
      yield {
        type: 'run_finished',
        iterations: iteration + 1,
        finalText: res.text,
        totals: totalsNow(),
      };
      return;
    }

    const resultParts = [];
    for (const call of res.toolCalls) {
      const runtimeTool = toolsByName.get(call.toolName);
      yield {
        type: 'tool_call',
        iteration,
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        toolVersionId: runtimeTool?.toolVersionId ?? null,
        input: call.input,
      };

      const toolStart = performance.now();
      const { output, isError } = await dispatch(call.toolName, call.input);

      yield {
        type: 'tool_result',
        iteration,
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output,
        isError,
        durationMs: Math.round(performance.now() - toolStart),
      };

      resultParts.push({
        type: 'tool-result' as const,
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: isError
          ? { type: 'error-text' as const, value: String(output) }
          : { type: 'json' as const, value: output as never },
      });
    }
    messages.push({ role: 'tool', content: resultParts });

    if (opts.signal?.aborted) {
      yield {
        type: 'run_error',
        reason: 'aborted',
        message: 'Run aborted',
        iteration,
        totals: totalsNow(),
      };
      return;
    }
    if (totals.costUsd !== null && totals.costUsd >= costCeilingUsd) {
      yield {
        type: 'run_error',
        reason: 'cost_ceiling',
        message: `Run cost reached $${totals.costUsd.toFixed(4)} (ceiling $${costCeilingUsd})`,
        iteration,
        totals: totalsNow(),
      };
      return;
    }
  }

  yield {
    type: 'run_error',
    reason: 'max_iterations',
    message: `Run did not finish within ${maxIterations} iterations`,
    iteration: maxIterations - 1,
    totals: totalsNow(),
  };
}

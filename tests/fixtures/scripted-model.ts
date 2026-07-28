import { MockLanguageModelV4 } from 'ai/test';

interface ScriptedToolCall {
  toolName: string;
  input: Record<string, unknown>;
  toolCallId?: string;
}

interface ScriptedStep {
  text?: string;
  toolCalls?: ScriptedToolCall[];
  inputTokens?: number;
  outputTokens?: number;
}

function stepUsage(step: ScriptedStep) {
  const input = step.inputTokens ?? 10;
  const output = step.outputTokens ?? 5;
  return {
    inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: output, text: output, reasoning: 0 },
  };
}

/**
 * A deterministic LanguageModel that replays the given steps in order.
 * A step with toolCalls finishes as 'tool-calls'; a text-only step as 'stop'.
 * Inspect `model.doGenerateCalls` to assert what the loop sent each turn.
 */
export function scriptedModel(steps: ScriptedStep[]): MockLanguageModelV4 {
  let call = 0;
  return new MockLanguageModelV4({
    modelId: 'scripted',
    doGenerate: async () => {
      const step = steps[call];
      if (!step) throw new Error(`scriptedModel exhausted after ${call} steps`);
      call += 1;
      const toolCalls = step.toolCalls ?? [];
      return {
        content: [
          ...(step.text ? [{ type: 'text' as const, text: step.text }] : []),
          ...toolCalls.map((tc, i) => ({
            type: 'tool-call' as const,
            toolCallId: tc.toolCallId ?? `tc_${call}_${i}`,
            toolName: tc.toolName,
            input: JSON.stringify(tc.input),
          })),
        ],
        finishReason:
          toolCalls.length > 0
            ? { unified: 'tool-calls' as const, raw: 'tool_use' }
            : { unified: 'stop' as const, raw: 'end_turn' },
        usage: stepUsage(step),
        warnings: [],
      };
    },
  });
}

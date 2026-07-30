import type { AgentEvent } from './events';
import type { RuntimeTool } from './loop';
import type { DispatchOutcome } from './tool-dispatch';

interface PromptedCall {
  toolName: string;
  input: Record<string, unknown>;
}

/**
 * Tool calling for endpoints that do not implement the OpenAI `tools`
 * parameter — Apple's foundation-model shims, older llama.cpp builds, and
 * plenty of local servers that accept `tools` and answer in prose anyway.
 *
 * The tools go in the system prompt and the model answers with a JSON object
 * we parse back out. Strictly worse than native tool calling — the model can
 * malform it, and it costs prompt tokens — so it is opt-in per connection.
 */
export function toolManifest(tools: RuntimeTool[]): string {
  const described = tools
    .map((t) => `- ${t.name}: ${t.description}\n  input schema: ${JSON.stringify(t.inputSchema)}`)
    .join('\n');

  return [
    'You have tools. To use one, reply with a single JSON object and nothing else:',
    '{"tool": "<name>", "input": {<arguments>}}',
    '',
    'Tools:',
    described,
    '',
    'Rules:',
    '- Use a tool whenever it can answer the question better than you can, and',
    '  always when asked for live data such as the current time.',
    '- When you call a tool, the JSON object must be your entire reply.',
    '- You will then be given the result, and should answer the user in plain',
    '  prose using it. Never invent a tool name that is not listed above.',
  ].join('\n');
}

/** Pulls the first JSON object out of a fenced block or bare text. */
function candidates(text: string): string[] {
  const found: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/g;
  for (const match of text.matchAll(fenced)) if (match[1]) found.push(match[1].trim());

  // Brace matching rather than a regex: tool inputs nest.
  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) {
        found.push(text.slice(start, i + 1));
        break;
      }
    }
  }
  return found;
}

/**
 * Returns the call the model asked for, or null when the text is an ordinary
 * answer. Prose must never be mistaken for a malformed call — that would turn
 * every reply into a failed tool round-trip.
 */
function parsePromptedCall(text: string): PromptedCall | null {
  for (const candidate of candidates(text)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) continue;
    const { tool, input } = parsed as { tool?: unknown; input?: unknown };
    if (typeof tool !== 'string' || !tool) continue;
    return {
      toolName: tool,
      input: typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {},
    };
  }
  return null;
}

/** How a tool result is handed back when the `tool` role is not available. */
function observationText(toolName: string, output: unknown, isError: boolean): string {
  const rendered = typeof output === 'string' ? output : JSON.stringify(output);
  return isError
    ? `Tool ${toolName} failed: ${rendered}\nAnswer the user directly.`
    : `Tool ${toolName} returned: ${rendered}\nUse this to answer the user in plain prose. Do not call another tool unless you still need one.`;
}

/**
 * One turn in prompted mode: parse the reply, run whatever it asked for, and
 * return the observation to feed back — or null when the reply was the answer.
 */
export async function* promptedTurn(opts: {
  iteration: number;
  text: string;
  tools: RuntimeTool[];
  dispatch: (toolName: string, input: unknown) => Promise<DispatchOutcome>;
}): AsyncGenerator<AgentEvent, string | null> {
  const { iteration, text, tools, dispatch } = opts;
  const call = parsePromptedCall(text);
  if (!call) return null;

  const shared = {
    iteration,
    toolCallId: `prompted_${iteration}`,
    toolName: call.toolName,
  } as const;

  yield {
    type: 'tool_call',
    ...shared,
    toolVersionId: tools.find((t) => t.name === call.toolName)?.toolVersionId ?? null,
    input: call.input,
  };

  const startedAt = performance.now();
  const { output, isError } = await dispatch(call.toolName, call.input);
  yield {
    type: 'tool_result',
    ...shared,
    output,
    isError,
    durationMs: Math.round(performance.now() - startedAt),
  };

  return observationText(call.toolName, output, isError);
}

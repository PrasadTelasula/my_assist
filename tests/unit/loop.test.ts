import { describe, expect, it } from 'vitest';

import type { AgentEvent } from '@/core/events';
import { runAgentLoop } from '@/core/loop';
import type { LoopOptions, RuntimeTool } from '@/core/loop';

import { scriptedModel } from '../fixtures/scripted-model';

function echoTool(overrides: Partial<RuntimeTool> = {}): RuntimeTool {
  return {
    name: 'echo',
    description: 'Echo text back',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    toolVersionId: null,
    execute: async (input) => ({ output: { echoed: (input as { text: string }).text } }),
    ...overrides,
  };
}

async function collect(
  model: ReturnType<typeof scriptedModel>,
  overrides: Partial<LoopOptions> = {},
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  const loop = runAgentLoop({
    model,
    modelRef: { provider: 'anthropic', modelId: 'claude-sonnet-5' },
    system: 'You are a test agent.',
    messages: [{ role: 'user', content: 'hello' }],
    tools: [],
    ...overrides,
  });
  for await (const event of loop) events.push(event);
  return events;
}

function ofType<T extends AgentEvent['type']>(events: AgentEvent[], type: T) {
  return events.filter((e): e is Extract<AgentEvent, { type: T }> => e.type === type);
}

describe('runAgentLoop', () => {
  it('finishes a text-only turn with usage, cost, and latency', async () => {
    const events = await collect(
      scriptedModel([{ text: 'Hi!', inputTokens: 7, outputTokens: 13 }]),
    );

    expect(events[0]).toEqual({ type: 'iteration_started', iteration: 0 });
    const [response] = ofType(events, 'model_response');
    expect(response).toBeDefined();
    expect(response!.text).toBe('Hi!');
    expect(response!.usage).toEqual({ inputTokens: 7, outputTokens: 13 });
    expect(response!.costUsd).toBeGreaterThan(0);
    expect(response!.latencyMs).toBeGreaterThanOrEqual(0);
    expect(response!.finishReason).toBe('stop');

    const [finished] = ofType(events, 'run_finished');
    expect(finished).toBeDefined();
    expect(finished!.finalText).toBe('Hi!');
    expect(finished!.iterations).toBe(1);
    expect(finished!.totals.inputTokens).toBe(7);
    expect(finished!.totals.outputTokens).toBe(13);
  });

  it('executes a tool call and feeds the result back to the model', async () => {
    const model = scriptedModel([
      {
        text: 'Checking.',
        toolCalls: [{ toolName: 'echo', input: { text: 'hi' }, toolCallId: 'tc_9' }],
      },
      { text: 'It said: hi' },
    ]);
    const events = await collect(model, { tools: [echoTool()] });

    const [call] = ofType(events, 'tool_call');
    expect(call).toMatchObject({ toolCallId: 'tc_9', toolName: 'echo', input: { text: 'hi' } });

    const [result] = ofType(events, 'tool_result');
    expect(result).toMatchObject({
      toolCallId: 'tc_9',
      output: { echoed: 'hi' },
      isError: false,
    });
    expect(result!.durationMs).toBeGreaterThanOrEqual(0);

    const [finished] = ofType(events, 'run_finished');
    expect(finished!.finalText).toBe('It said: hi');
    expect(finished!.iterations).toBe(2);

    // The second model call must include the assistant tool-call turn and our tool result.
    const secondPrompt = model.doGenerateCalls[1]!.prompt;
    const roles = secondPrompt.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'tool']);
    const toolMessage = secondPrompt.find((m) => m.role === 'tool')!;
    expect(toolMessage.content[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'tc_9',
      toolName: 'echo',
    });
  });

  it('reports a throwing tool as an error result and keeps the run alive', async () => {
    const model = scriptedModel([
      { toolCalls: [{ toolName: 'echo', input: { text: 'x' } }] },
      { text: 'recovered' },
    ]);
    const broken = echoTool({
      execute: async () => {
        throw new Error('boom');
      },
    });
    const events = await collect(model, { tools: [broken] });

    const [result] = ofType(events, 'tool_result');
    expect(result!.isError).toBe(true);
    expect(String(result!.output)).toContain('boom');
    const [finished] = ofType(events, 'run_finished');
    expect(finished!.finalText).toBe('recovered');
  });

  it('sends no tool list at all when the agent has no tools', async () => {
    const model = scriptedModel([{ text: 'Just chatting.' }]);
    await collect(model, { tools: [] });

    // An empty tool list still advertises tool calling; small models then
    // invent tools. A plain conversation must look plain to the provider.
    expect(model.doGenerateCalls[0]!.tools ?? []).toHaveLength(0);
  });

  it('names the available tools when the model invents one', async () => {
    const model = scriptedModel([
      { toolCalls: [{ toolName: 'hello', input: {} }] },
      { text: 'ok' },
    ]);
    const events = await collect(model, { tools: [echoTool()] });

    const [result] = ofType(events, 'tool_result');
    expect(result!.isError).toBe(true);
    expect(String(result!.output)).toContain('Unknown tool: hello');
    expect(String(result!.output)).toContain('Available tools: echo');
  });

  it('answers unknown tool calls with an error result', async () => {
    const model = scriptedModel([
      { toolCalls: [{ toolName: 'missing', input: {} }] },
      { text: 'ok' },
    ]);
    const events = await collect(model, { tools: [echoTool()] });

    const [result] = ofType(events, 'tool_result');
    expect(result!.isError).toBe(true);
    expect(String(result!.output)).toMatch(/unknown tool/i);
  });

  it('stops with run_error after max iterations', async () => {
    const steps = Array.from({ length: 5 }, () => ({
      toolCalls: [{ toolName: 'echo', input: { text: 'again' } }],
    }));
    const events = await collect(scriptedModel(steps), {
      tools: [echoTool()],
      maxIterations: 3,
    });

    expect(ofType(events, 'iteration_started')).toHaveLength(3);
    const [error] = ofType(events, 'run_error');
    expect(error!.reason).toBe('max_iterations');
  });

  it('stops with run_error when the cost ceiling is hit', async () => {
    const steps = Array.from({ length: 10 }, () => ({
      toolCalls: [{ toolName: 'echo', input: { text: 'again' } }],
      inputTokens: 500_000,
      outputTokens: 500_000,
    }));
    const events = await collect(scriptedModel(steps), {
      tools: [echoTool()],
      costCeilingUsd: 10,
    });

    const [error] = ofType(events, 'run_error');
    expect(error).toBeDefined();
    expect(error!.reason).toBe('cost_ceiling');
    expect(ofType(events, 'iteration_started').length).toBeLessThan(10);
  });

  it('honors an abort signal between iterations', async () => {
    const controller = new AbortController();
    const model = scriptedModel([
      { toolCalls: [{ toolName: 'echo', input: { text: 'x' } }] },
      { text: 'never reached' },
    ]);
    const abortingTool = echoTool({
      execute: async () => {
        controller.abort();
        return { output: 'done' };
      },
    });
    const events = await collect(model, { tools: [abortingTool], signal: controller.signal });

    const [error] = ofType(events, 'run_error');
    expect(error!.reason).toBe('aborted');
    expect(ofType(events, 'run_finished')).toHaveLength(0);
  });

  it('reports null cost for models missing from the pricing table', async () => {
    const events = await collect(scriptedModel([{ text: 'hi' }]), {
      modelRef: { provider: 'openrouter', modelId: 'not/priced' },
    });
    const [response] = ofType(events, 'model_response');
    expect(response!.costUsd).toBeNull();
    const [finished] = ofType(events, 'run_finished');
    expect(finished!.totals.costUsd).toBeNull();
  });

  describe('prompted tool mode, for endpoints without native tool calling', () => {
    it('describes the tools in the prompt and sends no tools field', async () => {
      const model = scriptedModel([{ text: 'Nothing to do.' }]);
      await collect(model, { tools: [echoTool()], toolMode: 'prompted' });

      const call = model.doGenerateCalls[0]!;
      expect(call.tools ?? []).toHaveLength(0);
      const system = call.prompt.find((m) => m.role === 'system');
      const systemText = JSON.stringify(system);
      expect(systemText).toContain('echo');
      expect(systemText).toContain('Echo text back');
    });

    it('parses a JSON tool call out of plain text, runs it, and feeds the result back', async () => {
      const model = scriptedModel([
        { text: '{"tool": "echo", "input": {"text": "hi"}}' },
        { text: 'It echoed hi.' },
      ]);
      const events = await collect(model, { tools: [echoTool()], toolMode: 'prompted' });

      const calls = ofType(events, 'tool_call');
      expect(calls).toHaveLength(1);
      expect(calls[0]!.toolName).toBe('echo');
      expect(calls[0]!.input).toEqual({ text: 'hi' });

      const results = ofType(events, 'tool_result');
      expect(results[0]!.output).toEqual({ echoed: 'hi' });
      expect(results[0]!.isError).toBe(false);

      // The observation must reach the model as ordinary text — endpoints that
      // lack tool calling generally reject the `tool` role too.
      const second = JSON.stringify(model.doGenerateCalls[1]!.prompt);
      expect(second).toContain('echoed');
      expect(second).not.toContain('"role":"tool"');

      const finished = ofType(events, 'run_finished');
      expect(finished[0]!.finalText).toBe('It echoed hi.');
    });

    it('accepts a fenced json block, which is what most models actually emit', async () => {
      const model = scriptedModel([
        { text: 'Sure.\n```json\n{"tool": "echo", "input": {"text": "yo"}}\n```' },
        { text: 'done' },
      ]);
      const events = await collect(model, { tools: [echoTool()], toolMode: 'prompted' });
      expect(ofType(events, 'tool_call')[0]!.input).toEqual({ text: 'yo' });
    });

    it('treats ordinary prose as a final answer, not a malformed call', async () => {
      const model = scriptedModel([{ text: 'The answer is 4.' }]);
      const events = await collect(model, { tools: [echoTool()], toolMode: 'prompted' });

      expect(ofType(events, 'tool_call')).toHaveLength(0);
      expect(ofType(events, 'run_finished')[0]!.finalText).toBe('The answer is 4.');
    });

    it('tells the model what exists when it invents a tool name', async () => {
      const model = scriptedModel([
        { text: '{"tool": "teleport", "input": {}}' },
        { text: 'Sorry, answering directly.' },
      ]);
      const events = await collect(model, { tools: [echoTool()], toolMode: 'prompted' });

      const result = ofType(events, 'tool_result')[0]!;
      expect(result.isError).toBe(true);
      expect(String(result.output)).toContain('echo');
    });
  });
});

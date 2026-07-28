import { describe, expect, it } from 'vitest';

import { registerFakeModel, resolveModel } from '@/core/model-registry';

import { scriptedModel } from '../fixtures/scripted-model';

describe('resolveModel', () => {
  it.each([
    ['anthropic', 'claude-sonnet-5'],
    ['openai', 'gpt-4o'],
    ['google', 'gemini-2.5-pro'],
    ['openrouter', 'meta-llama/llama-3.3-70b-instruct'],
    ['ollama', 'llama3.2'],
  ] as const)('resolves a %s model', (provider, modelId) => {
    const model = resolveModel({ provider, modelId }, { apiKey: 'test-key' });
    expect(model.modelId).toBe(modelId);
  });

  it('resolves the fake provider to the registered scripted model', () => {
    const scripted = scriptedModel([{ text: 'canned' }]);
    registerFakeModel(() => scripted);
    const model = resolveModel({ provider: 'fake', modelId: 'anything' });
    expect(model).toBe(scripted);
  });

  it('throws a specific error when the fake provider has no registration', () => {
    registerFakeModel(null);
    expect(() => resolveModel({ provider: 'fake', modelId: 'x' })).toThrow(/fake model/i);
  });
});

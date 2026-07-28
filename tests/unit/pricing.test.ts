import { describe, expect, it } from 'vitest';

import { estimateCostUsd } from '@/core/pricing';

describe('estimateCostUsd', () => {
  it('prices a known model per million tokens', () => {
    const cost = estimateCostUsd(
      { provider: 'anthropic', modelId: 'claude-sonnet-5' },
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    );
    expect(cost).toBeCloseTo(3 + 15);
  });

  it('returns null for unknown models instead of guessing', () => {
    const cost = estimateCostUsd(
      { provider: 'openrouter', modelId: 'some/uncatalogued-model' },
      { inputTokens: 1000, outputTokens: 1000 },
    );
    expect(cost).toBeNull();
  });

  it('prices local ollama models at zero', () => {
    const cost = estimateCostUsd(
      { provider: 'ollama', modelId: 'llama3.2' },
      { inputTokens: 5000, outputTokens: 5000 },
    );
    expect(cost).toBe(0);
  });
});

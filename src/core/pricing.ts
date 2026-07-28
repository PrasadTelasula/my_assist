import type { ModelRef, TokenUsage } from './events';

interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

/**
 * USD per million tokens. Update deliberately when providers change prices;
 * models not listed cost `null` (shown as "unknown" in the UI, never guessed).
 */
const PRICES: Record<string, ModelPrice> = {
  'anthropic/claude-sonnet-5': { inputPerMTok: 3, outputPerMTok: 15 },
  'anthropic/claude-opus-5': { inputPerMTok: 15, outputPerMTok: 75 },
  'anthropic/claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
  'openai/gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10 },
  'openai/gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  'google/gemini-2.5-pro': { inputPerMTok: 1.25, outputPerMTok: 10 },
  'google/gemini-2.5-flash': { inputPerMTok: 0.3, outputPerMTok: 2.5 },
};

export function estimateCostUsd(ref: ModelRef, usage: TokenUsage): number | null {
  if (ref.provider === 'ollama') return 0;
  const price = PRICES[`${ref.provider}/${ref.modelId}`];
  if (!price) return null;
  return (
    (usage.inputTokens / 1_000_000) * price.inputPerMTok +
    (usage.outputTokens / 1_000_000) * price.outputPerMTok
  );
}

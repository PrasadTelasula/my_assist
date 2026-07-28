import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';

import type { ModelRef } from './events';

/** A provider model instance (never the bare model-id string form). */
type ResolvedModel = Exclude<LanguageModel, string>;

interface ProviderCredential {
  apiKey?: string;
  baseUrl?: string;
}

type FakeModelFactory = (ref: ModelRef) => ResolvedModel;

let fakeModelFactory: FakeModelFactory | null = null;

/** Test/e2e hook: makes `provider: 'fake'` resolve to a scripted model. */
export function registerFakeModel(factory: FakeModelFactory | null): void {
  fakeModelFactory = factory;
}

export function resolveModel(ref: ModelRef, credential: ProviderCredential = {}): ResolvedModel {
  const { apiKey, baseUrl } = credential;
  switch (ref.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL: baseUrl })(ref.modelId);
    case 'openai':
      return createOpenAI({ apiKey, baseURL: baseUrl })(ref.modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL: baseUrl })(ref.modelId);
    case 'openrouter':
      return createOpenRouter({ apiKey, baseURL: baseUrl })(ref.modelId);
    case 'ollama':
      return createOllama({ baseURL: baseUrl })(ref.modelId);
    case 'fake': {
      if (!fakeModelFactory) {
        throw new Error('No fake model registered — call registerFakeModel() first');
      }
      return fakeModelFactory(ref);
    }
  }
}

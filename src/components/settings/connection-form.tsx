'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '@/lib/api';
import { PROVIDER_KINDS, type ProviderKind } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys';

const KIND_HINTS: Record<ProviderKind, string> = {
  anthropic: 'Base URL optional — defaults to the Anthropic API.',
  openai: 'Base URL optional — defaults to the OpenAI API.',
  google: 'Base URL optional — defaults to the Gemini API.',
  openrouter: 'Base URL optional — defaults to openrouter.ai.',
  ollama: 'Point at your Ollama server, e.g. http://127.0.0.1:11434/v1',
  'openai-compatible':
    'Any server exposing /v1/chat/completions — apfel, llama.cpp, vLLM, LM Studio. Use the /v1 base, e.g. http://127.0.0.1:11434/v1',
};

export function ConnectionForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProviderKind>('openai-compatible');
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434/v1');
  const [apiKey, setApiKey] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.providers.create({
        name,
        kind,
        baseUrl: baseUrl.trim() || null,
        apiKey: apiKey.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers });
      onDone();
    },
  });

  return (
    <form
      className="border-edge bg-surface rounded-panel flex flex-col gap-3 border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-ink-muted flex flex-col gap-1 text-xs">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="apfel-local"
            className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 font-mono text-sm"
          />
        </label>
        <label className="text-ink-muted flex flex-col gap-1 text-xs">
          Kind
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProviderKind)}
            className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 text-sm"
          >
            {PROVIDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-ink-muted flex flex-col gap-1 text-xs">
        Base URL
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://127.0.0.1:11434/v1"
          className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 font-mono text-sm"
        />
        <span className="text-ink-faint">{KIND_HINTS[kind]}</span>
      </label>

      <label className="text-ink-muted flex flex-col gap-1 text-xs">
        Token / API key{' '}
        <span className="text-ink-faint">(leave blank if the server needs none)</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="none"
          className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 font-mono text-sm"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {create.isPending ? 'Saving…' : 'Add connection'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-ink-muted hover:text-ink rounded-control px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        {create.isError ? (
          <p className="text-destructive text-xs">{(create.error as Error).message}</p>
        ) : null}
      </div>
    </form>
  );
}

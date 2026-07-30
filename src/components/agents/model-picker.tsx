'use client';

import { useQuery } from '@tanstack/react-query';

import { Select, TextInput } from '@/components/ui/field';
import { api } from '@/lib/api';
import { type ConnectionItem } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys';

const BUILT_IN_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic', placeholder: 'claude-sonnet-5' },
  { value: 'openai', label: 'OpenAI', placeholder: 'gpt-4o' },
  { value: 'google', label: 'Google', placeholder: 'gemini-2.5-pro' },
  { value: 'openrouter', label: 'OpenRouter', placeholder: 'meta-llama/llama-3.3-70b-instruct' },
  { value: 'ollama', label: 'Ollama (local)', placeholder: 'llama3.2' },
] as const;

interface ModelSelection {
  connectionId: string | null;
  provider: string;
  modelId: string;
}

export function ModelPicker({
  connectionId = null,
  provider,
  modelId,
  onChange,
}: ModelSelection & { onChange: (value: ModelSelection) => void }) {
  const { data: connections } = useQuery({
    queryKey: queryKeys.providers,
    queryFn: api.providers.list,
  });
  const connection = connections?.find((c: ConnectionItem) => c.id === connectionId) ?? null;

  // Ask the endpoint what it serves, so local model ids can be picked, not typed.
  const { data: probe } = useQuery({
    queryKey: queryKeys.providerModels(connectionId ?? 'none'),
    queryFn: () => api.providers.test(connectionId!),
    enabled: connectionId !== null,
    staleTime: 60_000,
    retry: false,
  });

  const placeholder = connection
    ? 'model id from your server'
    : (BUILT_IN_PROVIDERS.find((p) => p.value === provider)?.placeholder ?? 'model id');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select
          value={connectionId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            const picked = connections?.find((c) => c.id === id);
            onChange({ connectionId: id, provider: picked?.kind ?? provider, modelId });
          }}
          aria-label="Connection"
          className="w-auto"
        >
          <option value="">Environment keys</option>
          {connections?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.kind})
            </option>
          ))}
        </Select>

        {connection ? null : (
          <Select
            value={provider}
            onChange={(e) => onChange({ connectionId: null, provider: e.target.value, modelId })}
            aria-label="Provider"
            className="w-auto"
          >
            {BUILT_IN_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        )}

        <TextInput
          value={modelId}
          onChange={(e) => onChange({ connectionId, provider, modelId: e.target.value })}
          placeholder={placeholder}
          aria-label="Model id"
          list={probe?.models.length ? 'discovered-models' : undefined}
          className="flex-1 font-mono"
        />
        {probe?.models.length ? (
          <datalist id="discovered-models">
            {probe.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        ) : null}
      </div>

      {connection ? (
        probe?.ok === false ? (
          <p className="text-warning text-xs">{probe.error}</p>
        ) : probe?.models.length ? (
          <p className="text-ink-faint text-xs">
            {probe.models.length} model{probe.models.length === 1 ? '' : 's'} available from{' '}
            <span className="font-mono">{connection.name}</span>
          </p>
        ) : null
      ) : null}
    </div>
  );
}

'use client';

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic', placeholder: 'claude-sonnet-5' },
  { value: 'openai', label: 'OpenAI', placeholder: 'gpt-4o' },
  { value: 'google', label: 'Google', placeholder: 'gemini-2.5-pro' },
  { value: 'openrouter', label: 'OpenRouter', placeholder: 'meta-llama/llama-3.3-70b-instruct' },
  { value: 'ollama', label: 'Ollama (local)', placeholder: 'llama3.2' },
] as const;

export function ModelPicker({
  provider,
  modelId,
  onChange,
}: {
  provider: string;
  modelId: string;
  onChange: (value: { provider: string; modelId: string }) => void;
}) {
  const selected = PROVIDERS.find((p) => p.value === provider);
  return (
    <div className="flex gap-2">
      <select
        value={provider}
        onChange={(e) => onChange({ provider: e.target.value, modelId })}
        aria-label="Provider"
        className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 text-sm"
      >
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        value={modelId}
        onChange={(e) => onChange({ provider, modelId: e.target.value })}
        placeholder={selected?.placeholder ?? 'model id'}
        aria-label="Model id"
        className="border-edge bg-surface text-ink rounded-control flex-1 border px-2 py-1.5 font-mono text-sm"
      />
    </div>
  );
}

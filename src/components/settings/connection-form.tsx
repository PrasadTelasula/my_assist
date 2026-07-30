'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Field, Select, TextInput } from '@/components/ui/field';
import { api } from '@/lib/api';
import { PROVIDER_KINDS, type ProviderKind, type ToolMode } from '@/lib/types';
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
  const [toolMode, setToolMode] = useState<ToolMode>('native');

  const create = useMutation({
    mutationFn: () =>
      api.providers.create({
        name,
        kind,
        baseUrl: baseUrl.trim() || null,
        apiKey: apiKey.trim() || null,
        toolMode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers });
      onDone();
    },
  });

  return (
    <form
      className={`${cardClass()} flex flex-col gap-4 p-5`}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="connection-name">
          <TextInput
            id="connection-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="apfel-local"
            className="font-mono"
          />
        </Field>
        <Field label="Kind" htmlFor="connection-kind">
          <Select
            id="connection-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ProviderKind)}
          >
            {PROVIDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Base URL" hint={KIND_HINTS[kind]} htmlFor="connection-url">
        <TextInput
          id="connection-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://127.0.0.1:11434/v1"
          className="font-mono"
        />
      </Field>

      <Field
        label="Token / API key"
        hint="Leave blank if the server needs none."
        htmlFor="connection-key"
      >
        <TextInput
          id="connection-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="none"
          className="font-mono"
        />
      </Field>

      <Field
        label="Tool mode"
        hint="Native sends the tools parameter. Switch to prompted if Test reports no tool call — the tools go in the system prompt instead."
        htmlFor="connection-tool-mode"
      >
        <Select
          id="connection-tool-mode"
          value={toolMode}
          onChange={(e) => setToolMode(e.target.value as ToolMode)}
        >
          <option value="native">Native tool calling</option>
          <option value="prompted">Prompted tool calling</option>
        </Select>
      </Field>

      <div className="border-edge flex items-center gap-2 border-t pt-4">
        <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
          {create.isPending ? 'Saving…' : 'Add connection'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {create.isError ? (
          <p className="text-destructive text-xs">{(create.error as Error).message}</p>
        ) : null}
      </div>
    </form>
  );
}

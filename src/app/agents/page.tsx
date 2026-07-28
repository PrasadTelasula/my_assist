'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ModelPicker } from '@/components/agents/model-picker';
import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

function NewAgentForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [model, setModel] = useState({ provider: 'anthropic', modelId: 'claude-sonnet-5' });

  const create = useMutation({
    mutationFn: () =>
      api.agents.create({
        name,
        systemPrompt: `You are ${name}, a helpful, pragmatic assistant. Use your tools when they help; answer directly when they do not.`,
        modelProvider: model.provider,
        modelId: model.modelId,
      }),
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      onDone();
      router.push(`/agents/${agent.id}`);
    },
  });

  return (
    <form
      className="border-edge bg-surface rounded-panel m-4 flex flex-col gap-2 border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name && model.modelId) create.mutate();
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Agent name"
        aria-label="Agent name"
        className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 text-sm"
      />
      <ModelPicker provider={model.provider} modelId={model.modelId} onChange={setModel} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name || !model.modelId || create.isPending}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          Create agent
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-ink-muted hover:text-ink rounded-control px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
      {create.isError ? (
        <p className="text-destructive text-xs">{(create.error as Error).message}</p>
      ) : null}
    </form>
  );
}

export default function AgentsPage() {
  const { data: agents, isLoading } = useQuery({
    queryKey: queryKeys.agents,
    queryFn: api.agents.list,
  });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader title="Agents">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          New agent
        </button>
      </PageHeader>
      {creating ? <NewAgentForm onDone={() => setCreating(false)} /> : null}
      {isLoading ? (
        <p className="text-ink-faint p-6 text-sm">Loading agents…</p>
      ) : agents?.length ? (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="border-edge bg-surface rounded-panel hover:border-accent-500/50 shadow-panel border p-4 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="bg-accent-600/15 text-accent-500 rounded-control grid size-7 place-items-center text-xs font-semibold">
                  {agent.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-ink text-sm font-medium">{agent.name}</span>
              </div>
              <p className="text-ink-muted mt-2 line-clamp-2 text-xs">
                {agent.description || 'No description yet.'}
              </p>
              <p className="text-ink-faint mt-2 font-mono text-[11px]">
                {agent.modelProvider}/{agent.modelId}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          message="No agents yet — create one to get started."
          hint="An agent is a system prompt, a model, and a set of tools."
        />
      )}
    </>
  );
}

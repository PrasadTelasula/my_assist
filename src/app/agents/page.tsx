'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ModelPicker } from '@/components/agents/model-picker';
import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { TextInput } from '@/components/ui/field';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

function NewAgentForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [model, setModel] = useState({
    connectionId: null as string | null,
    provider: 'anthropic',
    modelId: 'claude-sonnet-5',
  });

  const create = useMutation({
    mutationFn: () =>
      api.agents.create({
        name,
        systemPrompt: `You are ${name}, a helpful, pragmatic assistant. Use your tools when they help; answer directly when they do not.`,
        modelProvider: model.provider,
        modelId: model.modelId,
        providerConnectionId: model.connectionId,
      }),
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      onDone();
      router.push(`/agents/${agent.id}`);
    },
  });

  return (
    <form
      className={`${cardClass()} mx-6 mt-6 flex flex-col gap-3 p-4`}
      onSubmit={(e) => {
        e.preventDefault();
        if (name && model.modelId) create.mutate();
      }}
    >
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Agent name"
        aria-label="Agent name"
      />
      <ModelPicker
        connectionId={model.connectionId}
        provider={model.provider}
        modelId={model.modelId}
        onChange={setModel}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={!name || !model.modelId || create.isPending}
        >
          Create agent
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
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
        <Button type="button" variant="primary" onClick={() => setCreating(true)}>
          New agent
        </Button>
      </PageHeader>
      {creating ? <NewAgentForm onDone={() => setCreating(false)} /> : null}
      {isLoading ? (
        <p className="text-ink-faint p-6 text-sm">Loading agents…</p>
      ) : agents?.length ? (
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className={`${cardClass(true)} flex flex-col gap-3 p-4`}
            >
              <div className="flex items-center gap-2.5">
                <span className="bg-accent-100 text-accent-700 dark:bg-accent-600/20 dark:text-accent-400 rounded-control grid size-9 shrink-0 place-items-center text-sm font-semibold">
                  {agent.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-ink truncate text-sm font-semibold">{agent.name}</span>
              </div>
              <p className="text-ink-muted line-clamp-2 min-h-8 text-xs leading-relaxed">
                {agent.description || 'No description yet.'}
              </p>
              <div className="border-edge flex flex-wrap items-center gap-1.5 border-t pt-3">
                <span className="bg-surface-muted text-ink-muted rounded-control px-2 py-0.5 font-mono text-[11px]">
                  {agent.modelProvider}/{agent.modelId}
                </span>
                {agent.connectionName ? (
                  <span className="bg-accent-100 text-accent-700 dark:bg-accent-600/20 dark:text-accent-400 rounded-control px-2 py-0.5 font-mono text-[11px]">
                    {agent.connectionName}
                  </span>
                ) : null}
              </div>
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

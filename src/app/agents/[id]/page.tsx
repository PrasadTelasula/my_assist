'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import { ModelPicker } from '@/components/agents/model-picker';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data: agent } = useQuery({
    queryKey: queryKeys.agent(id),
    queryFn: () => api.agents.get(id),
  });
  const { data: allTools } = useQuery({ queryKey: queryKeys.tools, queryFn: api.tools.list });

  const [form, setForm] = useState({
    systemPrompt: '',
    modelProvider: 'anthropic',
    modelId: '',
    providerConnectionId: null as string | null,
    maxIterations: 20,
    costCeilingUsd: 1,
  });
  const [toolIds, setToolIds] = useState<string[]>([]);

  useEffect(() => {
    if (!agent) return;
    setForm({
      systemPrompt: agent.systemPrompt,
      modelProvider: agent.modelProvider,
      modelId: agent.modelId,
      providerConnectionId: agent.providerConnectionId,
      maxIterations: agent.maxIterations,
      costCeilingUsd: Number(agent.costCeilingUsd),
    });
    setToolIds(agent.toolIds);
  }, [agent]);

  const save = useMutation({
    mutationFn: async () => {
      await api.agents.update(id, form);
      await api.agents.setTools(id, toolIds);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agent(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
    },
  });

  if (!agent) return <p className="text-ink-faint p-6 text-sm">Loading agent…</p>;

  return (
    <>
      <PageHeader title={agent.name}>
        <Link
          href={`/agents/${id}/editor`}
          className="border-edge text-ink-muted hover:text-ink rounded-control border px-2.5 py-1.5 text-sm transition-colors"
        >
          Open tool editor
        </Link>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </PageHeader>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <section className="flex flex-col gap-1.5">
          <label htmlFor="system-prompt" className="text-ink text-sm font-medium">
            System prompt
          </label>
          <p className="text-ink-faint text-xs">
            The agent&apos;s harness in plain sight — edit it, save, and the next run uses it.
          </p>
          <textarea
            id="system-prompt"
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={8}
            className="border-edge bg-surface text-ink rounded-control border px-3 py-2 font-mono text-sm leading-relaxed"
          />
        </section>

        <section className="flex flex-col gap-1.5">
          <span className="text-ink text-sm font-medium">Model</span>
          <ModelPicker
            connectionId={form.providerConnectionId}
            provider={form.modelProvider}
            modelId={form.modelId}
            onChange={({ connectionId, provider, modelId }) =>
              setForm({
                ...form,
                providerConnectionId: connectionId,
                modelProvider: provider,
                modelId,
              })
            }
          />
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="max-iterations" className="text-ink text-sm font-medium">
              Max iterations
            </label>
            <input
              id="max-iterations"
              type="number"
              min={1}
              max={100}
              value={form.maxIterations}
              onChange={(e) => setForm({ ...form, maxIterations: Number(e.target.value) })}
              className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 font-mono text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cost-ceiling" className="text-ink text-sm font-medium">
              Cost ceiling (USD per run)
            </label>
            <input
              id="cost-ceiling"
              type="number"
              min={0.01}
              step={0.05}
              value={form.costCeilingUsd}
              onChange={(e) => setForm({ ...form, costCeilingUsd: Number(e.target.value) })}
              className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 font-mono text-sm"
            />
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <span className="text-ink text-sm font-medium">Tools</span>
          {allTools?.length ? (
            <ul className="flex flex-col gap-1">
              {allTools.map((tool) => (
                <li key={tool.id}>
                  <label className="border-edge bg-surface rounded-control flex cursor-pointer items-center gap-2 border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={toolIds.includes(tool.id)}
                      onChange={(e) =>
                        setToolIds(
                          e.target.checked
                            ? [...toolIds, tool.id]
                            : toolIds.filter((t) => t !== tool.id),
                        )
                      }
                      className="accent-accent-600"
                    />
                    <span className="text-ink font-mono text-sm">{tool.name}</span>
                    <span className="text-ink-faint text-xs">{tool.description}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-faint text-xs">
              No tools yet — write one in the{' '}
              <Link href={`/agents/${id}/editor`} className="text-accent-500 hover:underline">
                tool editor
              </Link>
              .
            </p>
          )}
        </section>

        {save.isError ? (
          <p className="text-destructive text-xs">{(save.error as Error).message}</p>
        ) : null}
        {save.isSuccess ? <p className="text-success text-xs">Saved.</p> : null}
      </div>
    </>
  );
}

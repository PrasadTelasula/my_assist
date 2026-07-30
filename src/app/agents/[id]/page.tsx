'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

import { ModelPicker } from '@/components/agents/model-picker';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Field, TextArea, TextInput } from '@/components/ui/field';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const router = useRouter();
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

  const startChat = useMutation({
    mutationFn: () => api.threads.create({ agentId: id, title: `Chat with ${agent?.name ?? ''}` }),
    onSuccess: (thread) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads });
      router.push(`/chat/${thread.id}`);
    },
  });

  if (!agent) return <p className="text-ink-faint p-6 text-sm">Loading agent…</p>;

  return (
    <>
      <PageHeader title={agent.name}>
        <Button type="button" onClick={() => startChat.mutate()} disabled={startChat.isPending}>
          {startChat.isPending ? 'Opening…' : 'Start chat'}
        </Button>
        <Link
          href={`/agents/${id}/editor`}
          className="border-edge bg-surface text-ink hover:border-edge-strong hover:bg-surface-muted rounded-control inline-flex h-9 shrink-0 items-center border px-3.5 text-sm font-medium transition-colors"
        >
          Open tool editor
        </Link>
        <Button
          type="button"
          variant="primary"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </PageHeader>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <section className={`${cardClass()} flex flex-col gap-1.5 p-5`}>
          <label htmlFor="system-prompt" className="text-ink text-sm font-semibold">
            System prompt
          </label>
          <p className="text-ink-muted mb-1 text-xs leading-relaxed">
            The agent&apos;s harness in plain sight — edit it, save, and the next run uses it.
          </p>
          <TextArea
            id="system-prompt"
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={8}
            className="font-mono"
          />
        </section>

        <section className={`${cardClass()} flex flex-col gap-2 p-5`}>
          <span className="text-ink text-sm font-semibold">Model</span>
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

        <section className={`${cardClass()} grid grid-cols-1 gap-4 p-5 sm:grid-cols-2`}>
          <Field
            label="Max iterations"
            hint="Hard stop on the tool-calling loop."
            htmlFor="max-iterations"
          >
            <TextInput
              id="max-iterations"
              type="number"
              min={1}
              max={100}
              value={form.maxIterations}
              onChange={(e) => setForm({ ...form, maxIterations: Number(e.target.value) })}
              className="font-mono"
            />
          </Field>
          <Field
            label="Cost ceiling (USD per run)"
            hint="The run aborts once spend crosses this."
            htmlFor="cost-ceiling"
          >
            <TextInput
              id="cost-ceiling"
              type="number"
              min={0.01}
              step={0.05}
              value={form.costCeilingUsd}
              onChange={(e) => setForm({ ...form, costCeilingUsd: Number(e.target.value) })}
              className="font-mono"
            />
          </Field>
        </section>

        <section className={`${cardClass()} flex flex-col gap-2 p-5`}>
          <span className="text-ink text-sm font-semibold">Tools</span>
          {allTools?.length && toolIds.length === 0 ? (
            <p className="text-warning border-warning/30 bg-warning/10 rounded-control mb-1 border px-2.5 py-2 text-xs leading-relaxed">
              Nothing attached — this agent is sent no tool list at all, so asking it to
              &ldquo;use&rdquo; a tool by name will only get you an apology. Tick one below and
              save.
            </p>
          ) : null}
          {allTools?.length ? (
            <ul className="flex flex-col gap-1">
              {allTools.map((tool) => (
                <li key={tool.id}>
                  <label className="border-edge hover:border-edge-strong rounded-control flex cursor-pointer items-center gap-2.5 border px-3 py-2 transition-colors">
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
                    <span className="text-ink font-mono text-sm font-medium">{tool.name}</span>
                    <span className="text-ink-faint truncate text-xs">{tool.description}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-faint text-xs">
              No tools yet — write one in the{' '}
              <Link
                href={`/agents/${id}/editor`}
                className="text-accent-600 font-medium hover:underline"
              >
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

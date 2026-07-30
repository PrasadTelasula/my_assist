'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { api } from '@/lib/api';
import { type ConnectionItem, type ToolMode } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys';

export function ConnectionCard({ connection }: { connection: ConnectionItem }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const test = useMutation({ mutationFn: () => api.providers.test(connection.id) });

  // A connection alone can't be chatted with — an agent is what runs. This is
  // the one-click bridge from "configured" to "usable".
  const createAgent = useMutation({
    mutationFn: async () => {
      const probe = await api.providers.test(connection.id);
      const modelId = probe.models[0];
      if (!modelId) {
        throw new Error(
          probe.error ?? 'No models reported by this endpoint — set a model id manually instead.',
        );
      }
      return api.agents.create({
        name: `${connection.name} agent`,
        description: `Runs on the ${connection.name} connection`,
        systemPrompt:
          'You are a helpful assistant. Answer the user directly and conversationally. Only call a tool if one is provided and clearly needed — never invent tool names.',
        modelProvider: connection.kind,
        modelId,
        providerConnectionId: connection.id,
      });
    },
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      router.push(`/agents/${agent.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.providers.remove(connection.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.providers }),
  });
  const setToolMode = useMutation({
    mutationFn: (toolMode: ToolMode) => api.providers.update(connection.id, { toolMode }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.providers }),
  });

  return (
    <li className={`${cardClass()} p-4`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-ink font-mono text-sm font-semibold">{connection.name}</span>
        <span className="bg-accent-100 text-accent-700 dark:bg-accent-600/20 dark:text-accent-400 rounded-control px-2 py-0.5 text-[11px] font-medium">
          {connection.kind}
        </span>
        {connection.hasApiKey ? (
          <span className="bg-surface-muted text-ink-muted rounded-control px-2 py-0.5 text-[11px]">
            token set
          </span>
        ) : null}
        <span className="text-ink-faint min-w-40 flex-1 truncate font-mono text-[11px]">
          {connection.baseUrl ?? 'default endpoint'}
        </span>
        <div className="flex items-center gap-1.5">
          <Select
            value={connection.toolMode}
            onChange={(e) => setToolMode.mutate(e.target.value as ToolMode)}
            disabled={setToolMode.isPending}
            aria-label={`Tool mode for ${connection.name}`}
            className="h-7 w-auto py-0 text-xs"
          >
            <option value="native">native tools</option>
            <option value="prompted">prompted tools</option>
          </Select>
          <Button type="button" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? 'Testing…' : 'Test'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => createAgent.mutate()}
            disabled={createAgent.isPending}
          >
            {createAgent.isPending ? 'Creating…' : 'Create agent'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => remove.mutate()}
            aria-label={`Delete ${connection.name}`}
          >
            Delete
          </Button>
        </div>
      </div>

      {test.data ? (
        test.data.ok ? (
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-success text-xs">
              Reachable · {test.data.models.length} model
              {test.data.models.length === 1 ? '' : 's'}:{' '}
              <span className="text-ink-muted font-mono">
                {test.data.models.slice(0, 6).join(', ')}
                {test.data.models.length > 6 ? ' …' : ''}
              </span>
            </p>
            {test.data.toolCalling === 'yes' ? (
              <p className="text-success text-xs">Tool calling: confirmed.</p>
            ) : test.data.toolCalling === 'no-call' ? (
              <div className="text-warning flex flex-col items-start gap-2 text-xs leading-relaxed">
                <p>
                  Tool calling: no answer. It was offered one function and told to call it, and
                  replied with prose instead — either the server ignores the{' '}
                  <span className="font-mono">tools</span> parameter, or the model declined.
                </p>
                {connection.toolMode === 'native' ? (
                  <p>
                    Switch this connection to <strong>prompted tools</strong> above: the tools go in
                    the system prompt instead, so they work on endpoints like this one.
                  </p>
                ) : (
                  <p>
                    Already on prompted tools, which needs no{' '}
                    <span className="font-mono">tools</span> parameter — this warning is expected
                    here, and your agents can still call tools.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-ink-faint text-xs">Tool calling: could not determine.</p>
            )}
          </div>
        ) : (
          <p className="text-destructive mt-2 text-xs">{test.data.error}</p>
        )
      ) : null}
      {createAgent.isError ? (
        <p className="text-destructive mt-2 text-xs">{(createAgent.error as Error).message}</p>
      ) : null}
      {remove.isError ? (
        <p className="text-destructive mt-2 text-xs">
          {(remove.error as Error).message} — detach it from any agents first.
        </p>
      ) : null}
    </li>
  );
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { type ConnectionItem } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys';

export function ConnectionCard({ connection }: { connection: ConnectionItem }) {
  const queryClient = useQueryClient();

  const test = useMutation({ mutationFn: () => api.providers.test(connection.id) });
  const remove = useMutation({
    mutationFn: () => api.providers.remove(connection.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.providers }),
  });

  return (
    <li className="border-edge bg-surface rounded-panel border p-3">
      <div className="flex items-center gap-2">
        <span className="text-ink font-mono text-sm font-semibold">{connection.name}</span>
        <span className="bg-surface-muted text-ink-muted rounded-control px-1.5 py-0.5 text-[11px]">
          {connection.kind}
        </span>
        {connection.hasApiKey ? (
          <span className="bg-surface-muted text-ink-muted rounded-control px-1.5 py-0.5 text-[11px]">
            token set
          </span>
        ) : null}
        <span className="text-ink-faint flex-1 truncate font-mono text-[11px]">
          {connection.baseUrl ?? 'default endpoint'}
        </span>
        <button
          type="button"
          onClick={() => test.mutate()}
          disabled={test.isPending}
          className="border-edge text-ink-muted hover:text-ink rounded-control border px-2 py-1 text-xs transition-colors disabled:opacity-50"
        >
          {test.isPending ? 'Testing…' : 'Test'}
        </button>
        <button
          type="button"
          onClick={() => remove.mutate()}
          aria-label={`Delete ${connection.name}`}
          className="text-ink-faint hover:text-destructive rounded-control px-2 py-1 text-xs transition-colors"
        >
          Delete
        </button>
      </div>

      {test.data ? (
        test.data.ok ? (
          <p className="text-success mt-2 text-xs">
            Reachable · {test.data.models.length} model
            {test.data.models.length === 1 ? '' : 's'}:{' '}
            <span className="text-ink-muted font-mono">
              {test.data.models.slice(0, 6).join(', ')}
              {test.data.models.length > 6 ? ' …' : ''}
            </span>
          </p>
        ) : (
          <p className="text-destructive mt-2 text-xs">{test.data.error}</p>
        )
      ) : null}
      {remove.isError ? (
        <p className="text-destructive mt-2 text-xs">
          {(remove.error as Error).message} — detach it from any agents first.
        </p>
      ) : null}
    </li>
  );
}

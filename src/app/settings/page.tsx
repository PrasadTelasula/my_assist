'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ConnectionCard } from '@/components/settings/connection-card';
import { ConnectionForm } from '@/components/settings/connection-form';
import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export default function SettingsPage() {
  const { data: connections, isLoading } = useQuery({
    queryKey: queryKeys.providers,
    queryFn: api.providers.list,
  });
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader title="Settings">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          Add connection
        </button>
      </PageHeader>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <section>
          <h2 className="text-ink text-sm font-medium">Model connections</h2>
          <p className="text-ink-muted mt-1 text-xs leading-relaxed">
            Point the platform at hosted providers or your own servers. Requests are made from the
            server process, so a local endpoint with CORS disabled works fine — it never sees a
            browser origin.
          </p>
        </section>

        {adding ? <ConnectionForm onDone={() => setAdding(false)} /> : null}

        {isLoading ? (
          <p className="text-ink-faint text-sm">Loading connections…</p>
        ) : connections?.length ? (
          <ul className="flex flex-col gap-2">
            {connections.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection} />
            ))}
          </ul>
        ) : (
          <EmptyState
            message="No connections yet — agents fall back to provider keys from your environment."
            hint="Add one to use a local server like apfel, Ollama, llama.cpp, or vLLM."
          />
        )}
      </div>
    </>
  );
}

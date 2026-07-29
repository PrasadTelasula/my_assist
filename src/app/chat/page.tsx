'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

function NewChatForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: agents } = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents.list });
  const [agentId, setAgentId] = useState('');
  const [title, setTitle] = useState('');

  const create = useMutation({
    mutationFn: () => api.threads.create({ agentId, title: title || 'New conversation' }),
    onSuccess: (thread) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads });
      onDone();
      router.push(`/chat/${thread.id}`);
    },
  });

  return (
    <form
      className="border-edge bg-surface rounded-panel m-4 flex flex-col gap-2 border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (agentId) create.mutate();
      }}
    >
      <select
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        aria-label="Agent"
        className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 text-sm"
      >
        <option value="">Choose an agent…</option>
        {agents?.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name} · {agent.modelId}
            {agent.connectionName ? ` (via ${agent.connectionName})` : ''}
          </option>
        ))}
      </select>
      {agents?.length === 0 ? (
        <p className="text-ink-faint text-xs">
          No agents yet — create one on the{' '}
          <Link href="/agents" className="text-accent-500 hover:underline">
            Agents
          </Link>{' '}
          page, or from a connection in{' '}
          <Link href="/settings" className="text-accent-500 hover:underline">
            Settings
          </Link>
          .
        </p>
      ) : null}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Conversation title (optional)"
        className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!agentId || create.isPending}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          Start chat
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

export default function ChatPage() {
  const { data: threads, isLoading } = useQuery({
    queryKey: queryKeys.threads,
    queryFn: api.threads.list,
  });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader title="Chat">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          New chat
        </button>
      </PageHeader>
      {creating ? <NewChatForm onDone={() => setCreating(false)} /> : null}
      {isLoading ? (
        <p className="text-ink-faint p-6 text-sm">Loading conversations…</p>
      ) : threads?.length ? (
        <ul className="divide-edge divide-y">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/chat/${thread.id}`}
                className="hover:bg-surface flex items-center justify-between px-6 py-3 transition-colors"
              >
                <span className="text-ink text-sm">{thread.title}</span>
                <span className="text-ink-faint text-xs">{thread.agentName}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          message="No conversations yet."
          hint="Start a chat and watch every tool call as it happens."
        />
      )}
    </>
  );
}

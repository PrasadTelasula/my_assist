'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Select, TextInput } from '@/components/ui/field';
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
      className={`${cardClass()} mx-6 mt-6 flex flex-col gap-3 p-4`}
      onSubmit={(e) => {
        e.preventDefault();
        if (agentId) create.mutate();
      }}
    >
      <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Agent">
        <option value="">Choose an agent…</option>
        {agents?.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name} · {agent.modelId}
            {agent.connectionName ? ` (via ${agent.connectionName})` : ''}
          </option>
        ))}
      </Select>
      {agents?.length === 0 ? (
        <p className="text-ink-faint text-xs">
          No agents yet — create one on the{' '}
          <Link href="/agents" className="text-accent-600 font-medium hover:underline">
            Agents
          </Link>{' '}
          page, or from a connection in{' '}
          <Link href="/settings" className="text-accent-600 font-medium hover:underline">
            Settings
          </Link>
          .
        </p>
      ) : null}
      <TextInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Conversation title (optional)"
        aria-label="Conversation title"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!agentId || create.isPending}>
          Start chat
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

export default function ChatPage() {
  const { data: threads, isLoading } = useQuery({
    queryKey: queryKeys.threads,
    queryFn: api.threads.list,
  });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader title="Chat">
        <Button type="button" variant="primary" onClick={() => setCreating(true)}>
          New chat
        </Button>
      </PageHeader>
      {creating ? <NewChatForm onDone={() => setCreating(false)} /> : null}
      {isLoading ? (
        <p className="text-ink-faint p-6 text-sm">Loading conversations…</p>
      ) : threads?.length ? (
        <div className="p-6">
          <ul className={`${cardClass()} divide-edge divide-y overflow-hidden`}>
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/chat/${thread.id}`}
                  className="hover:bg-surface-muted flex items-center justify-between gap-4 px-4 py-3 transition-colors"
                >
                  <span className="text-ink truncate text-sm font-medium">{thread.title}</span>
                  <span className="bg-surface-muted text-ink-muted rounded-control shrink-0 px-2 py-0.5 text-[11px]">
                    {thread.agentName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          message="No conversations yet."
          hint="Start a chat and watch every tool call as it happens."
        />
      )}
    </>
  );
}

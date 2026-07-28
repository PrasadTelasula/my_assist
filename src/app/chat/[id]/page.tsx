'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { use, useEffect, useRef, useState } from 'react';

import { PageHeader } from '@/components/shell/page-header';
import { TraceTimeline } from '@/components/trace/trace-timeline';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useRunEvents } from '@/lib/use-run-events';

export default function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: threadId } = use(params);
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(true);
  const [draft, setDraft] = useState('');
  const { events, live } = useRunEvents(activeRunId);
  const wasLive = useRef(false);

  const { data: thread } = useQuery({
    queryKey: queryKeys.thread(threadId),
    queryFn: () => api.threads.get(threadId),
  });

  const send = useMutation({
    mutationFn: (text: string) => api.threads.postMessage(threadId, text),
    onSuccess: ({ runId }) => {
      setActiveRunId(runId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.thread(threadId) });
    },
  });

  // When the live run ends, refresh the transcript to pick up the reply.
  useEffect(() => {
    if (wasLive.current && !live) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.thread(threadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs });
    }
    wasLive.current = live;
  }, [live, queryClient, threadId]);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader title={thread?.title ?? 'Conversation'}>
        <button
          type="button"
          onClick={() => setShowTrace((v) => !v)}
          aria-pressed={showTrace}
          className="border-edge text-ink-muted hover:text-ink rounded-control border px-2.5 py-1 text-xs transition-colors"
        >
          {showTrace ? 'Hide trace' : 'Show trace'}
        </button>
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-6">
            {thread?.messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-panel max-w-[80%] px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-accent-600/10 text-ink ml-auto'
                    : 'bg-surface border-edge text-ink border'
                }`}
              >
                {message.content}
              </div>
            ))}
            {live ? (
              <p className="text-ink-faint text-xs" role="status">
                Agent is working…
              </p>
            ) : null}
            {send.isError ? (
              <p className="text-destructive text-xs">{(send.error as Error).message}</p>
            ) : null}
          </div>
          <form
            className="border-edge flex gap-2 border-t p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft.trim();
              if (!text || live) return;
              setDraft('');
              send.mutate(text);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the agent…"
              aria-label="Message"
              className="border-edge bg-surface text-ink rounded-control flex-1 border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={live || !draft.trim()}
              className="bg-accent-600 hover:bg-accent-700 rounded-control px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>

        {showTrace ? (
          <aside className="border-edge bg-surface-muted w-96 shrink-0 overflow-y-auto border-l">
            <h2 className="text-ink-faint px-3 pt-3 text-[11px] font-medium tracking-wide uppercase">
              Run trace
            </h2>
            {activeRunId ? (
              <TraceTimeline events={events} live={live} />
            ) : (
              <p className="text-ink-faint p-3 text-xs">Send a message to watch the agent think.</p>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

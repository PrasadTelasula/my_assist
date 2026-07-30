'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { use, useEffect, useRef, useState } from 'react';

import { MessageBubble } from '@/components/chat/message-bubble';
import { PageHeader } from '@/components/shell/page-header';
import { TraceTimeline } from '@/components/trace/trace-timeline';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/field';
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

  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread } = useQuery({
    queryKey: queryKeys.thread(threadId),
    queryFn: () => api.threads.get(threadId),
  });
  const { data: agents } = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents.list });
  const agentName = agents?.find((a) => a.id === thread?.agentId)?.name ?? 'Agent';

  const submit = () => {
    const text = draft.trim();
    if (!text || live) return;
    setDraft('');
    send.mutate(text);
  };

  // Keep the newest turn in view as the conversation and the run progress.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread?.messages.length, live]);

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
        <Button
          type="button"
          size="sm"
          onClick={() => setShowTrace((v) => !v)}
          aria-pressed={showTrace}
        >
          {showTrace ? 'Hide trace' : 'Show trace'}
        </Button>
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            {/* Reading measure, not full bleed: long answers are unreadable edge to edge. */}
            <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
              {thread?.messages.length === 0 ? (
                <p className="text-ink-faint py-16 text-center text-sm">
                  Say something to get started.
                </p>
              ) : null}
              {thread?.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  agentName={agentName}
                />
              ))}
              {live ? (
                <p className="text-ink-faint flex items-center gap-2 text-xs" role="status">
                  <span className="border-accent-500 size-3 animate-spin rounded-full border-2 border-t-transparent" />
                  {agentName} is thinking…
                </p>
              ) : null}
              {send.isError ? (
                <p className="text-destructive rounded-control bg-destructive/10 px-3 py-2 text-xs">
                  {(send.error as Error).message}
                </p>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-edge bg-surface border-t">
            <form
              className="mx-auto flex max-w-2xl items-end gap-2 px-6 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <TextArea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter is a newline, as in every chat app.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder={`Message ${agentName}…`}
                aria-label="Message"
                className="max-h-40 flex-1 resize-none"
              />
              <Button type="submit" variant="primary" disabled={live || !draft.trim()}>
                Send
              </Button>
            </form>
            <p className="text-ink-faint mx-auto max-w-2xl px-6 pb-3 text-[11px]">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>

        {showTrace ? (
          <aside className="border-edge bg-surface-muted w-96 shrink-0 overflow-y-auto border-l">
            <h2 className="text-ink-muted border-edge bg-surface sticky top-0 border-b px-4 py-3 text-[11px] font-semibold tracking-wider uppercase">
              Run trace
            </h2>
            {activeRunId ? (
              <TraceTimeline events={events} live={live} />
            ) : (
              <p className="text-ink-faint p-4 text-xs leading-relaxed">
                Send a message to watch the agent think — every model call, tool call, and token
                lands here live.
              </p>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

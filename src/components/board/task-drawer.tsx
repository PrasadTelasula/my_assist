'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { TraceTimeline } from '@/components/trace/trace-timeline';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useRunEvents } from '@/lib/use-run-events';

const KIND_STYLE: Record<string, string> = {
  agent_update: 'text-accent-500',
  blocked: 'text-warning',
  review: 'text-info',
  status_change: 'text-ink-faint',
  assignment: 'text-ink-faint',
  comment: 'text-ink',
};

export function TaskDrawer({
  taskId,
  agents,
  onClose,
}: {
  taskId: string;
  agents: { id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [showTrace, setShowTrace] = useState(false);

  const { data: task } = useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: () => api.tasks.get(taskId),
    refetchInterval: 2000,
  });
  const { data: activity } = useQuery({
    queryKey: queryKeys.taskActivity(taskId),
    queryFn: () => api.tasks.activity(taskId),
    refetchInterval: 2000,
  });
  const { events, live } = useRunEvents(showTrace ? (task?.latestRunId ?? null) : null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(taskId) });
  };

  const assign = useMutation({
    mutationFn: (assigneeAgentId: string | null) =>
      api.tasks.patch(taskId, assigneeAgentId ? { assigneeAgentId } : { assigneeAgentId: null }),
    onSuccess: invalidate,
  });
  const postComment = useMutation({
    mutationFn: () => api.tasks.comment(taskId, comment),
    onSuccess: () => {
      setComment('');
      invalidate();
    },
  });

  if (!task) return null;

  return (
    <aside className="border-edge bg-surface fixed inset-y-0 right-0 z-20 flex w-[26rem] flex-col border-l shadow-xl">
      <header className="border-edge flex items-start justify-between gap-2 border-b p-4">
        <div>
          <h2 className="text-ink text-sm font-semibold">{task.title}</h2>
          <p className="text-ink-faint mt-0.5 text-xs">
            {task.status.replace('_', ' ')}
            {task.points != null ? ` · ${task.points} pt` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task"
          className="text-ink-muted hover:text-ink rounded-control px-2 py-1 text-sm"
        >
          ✕
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {task.description ? (
          <p className="text-ink-muted text-xs leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        ) : null}

        <label className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">
          Assignee
          <select
            value={task.assigneeAgentId ?? ''}
            onChange={(e) => assign.mutate(e.target.value || null)}
            className="border-edge bg-surface text-ink rounded-control mt-1 block w-full border px-2 py-1.5 text-sm normal-case"
          >
            <option value="">Unassigned / you</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                🤖 {agent.name}
              </option>
            ))}
          </select>
        </label>
        {assign.isError ? (
          <p className="text-destructive text-xs">{(assign.error as Error).message}</p>
        ) : null}

        {task.latestRunId ? (
          <button
            type="button"
            onClick={() => setShowTrace((v) => !v)}
            className="border-edge text-ink-muted hover:text-ink rounded-control border px-2.5 py-1.5 text-left text-xs transition-colors"
          >
            {showTrace ? 'Hide run trace' : 'Show run trace'}
          </button>
        ) : null}
        {showTrace && task.latestRunId ? (
          <div className="border-edge rounded-panel max-h-80 overflow-y-auto border">
            <TraceTimeline events={events} live={live} />
          </div>
        ) : null}

        <section>
          <h3 className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">
            Activity
          </h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {activity?.map((entry) => (
              <li key={entry.id} className="text-xs leading-relaxed">
                <span className={`font-medium ${KIND_STYLE[entry.kind] ?? 'text-ink'}`}>
                  {entry.kind.replace('_', ' ')}
                </span>{' '}
                <span className="text-ink-muted">{entry.body}</span>
              </li>
            ))}
            {activity?.length === 0 ? (
              <li className="text-ink-faint text-xs">Nothing yet — assign an agent or comment.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <form
        className="border-edge flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (comment.trim()) postComment.mutate();
        }}
      >
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          aria-label="Comment"
          className="border-edge bg-surface text-ink rounded-control flex-1 border px-2 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={!comment.trim() || postComment.isPending}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
        >
          Post
        </button>
      </form>
    </aside>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { TraceTimeline } from '@/components/trace/trace-timeline';
import { Button } from '@/components/ui/button';
import { Select, TextInput } from '@/components/ui/field';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useRunEvents } from '@/lib/use-run-events';

const KIND_STYLE: Record<string, string> = {
  agent_update: 'text-accent-600',
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
    <aside className="border-edge bg-surface shadow-raised fixed inset-y-0 right-0 z-20 flex w-[26rem] flex-col border-l">
      <header className="border-edge flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <h2 className="text-ink text-sm font-semibold">{task.title}</h2>
          <p className="text-ink-faint mt-1 text-xs">
            {task.status.replace('_', ' ')}
            {task.points != null ? ` · ${task.points} pt` : ''}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close task">
          ✕
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {task.description ? (
          <p className="text-ink-muted text-xs leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        ) : null}

        <label className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
          Assignee
          <Select
            value={task.assigneeAgentId ?? ''}
            onChange={(e) => assign.mutate(e.target.value || null)}
            className="mt-1.5 normal-case"
          >
            <option value="">Unassigned / you</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                🤖 {agent.name}
              </option>
            ))}
          </Select>
        </label>
        {assign.isError ? (
          <p className="text-destructive text-xs">{(assign.error as Error).message}</p>
        ) : null}

        {task.latestRunId ? (
          <Button
            type="button"
            size="sm"
            className="self-start"
            onClick={() => setShowTrace((v) => !v)}
          >
            {showTrace ? 'Hide run trace' : 'Show run trace'}
          </Button>
        ) : null}
        {showTrace && task.latestRunId ? (
          <div className="border-edge rounded-panel bg-surface-muted max-h-80 overflow-y-auto border">
            <TraceTimeline events={events} live={live} />
          </div>
        ) : null}

        <section>
          <h3 className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
            Activity
          </h3>
          <ul className="divide-edge mt-1 flex flex-col divide-y">
            {activity?.map((entry) => (
              <li key={entry.id} className="py-2 text-xs leading-relaxed">
                <span className={`font-medium ${KIND_STYLE[entry.kind] ?? 'text-ink'}`}>
                  {entry.kind.replace('_', ' ')}
                </span>{' '}
                <span className="text-ink-muted">{entry.body}</span>
              </li>
            ))}
            {activity?.length === 0 ? (
              <li className="text-ink-faint pt-2 text-xs">
                Nothing yet — assign an agent or comment.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <form
        className="border-edge bg-surface-muted flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (comment.trim()) postComment.mutate();
        }}
      >
        <TextInput
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          aria-label="Comment"
          className="h-8 flex-1 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={!comment.trim() || postComment.isPending}
        >
          Post
        </Button>
      </form>
    </aside>
  );
}

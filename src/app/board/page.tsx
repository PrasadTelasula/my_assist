'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { KanbanBoard } from '@/components/board/kanban-board';
import { TaskDrawer } from '@/components/board/task-drawer';
import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { api, type TaskItem, type TaskStatus } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export default function BoardPage() {
  const queryClient = useQueryClient();
  const [sprintId, setSprintId] = useState<string | undefined>(undefined);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: sprints } = useQuery({ queryKey: queryKeys.sprints, queryFn: api.sprints.list });
  const { data: agents } = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents.list });
  const activeSprintId = sprintId ?? sprints?.[0]?.id;
  const { data: tasks } = useQuery({
    queryKey: queryKeys.tasks(activeSprintId),
    queryFn: () => api.tasks.list(activeSprintId),
    enabled: activeSprintId !== undefined,
    // Live-ish board without SSE yet; paused mid-drag so dnd state survives.
    refetchInterval: dragging ? false : 2000,
  });

  const agentNames = useMemo(
    () => new Map((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );

  const move = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.tasks.patch(taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      const key = queryKeys.tasks(activeSprintId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskItem[]>(key);
      queryClient.setQueryData<TaskItem[]>(key, (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status } : t)),
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const createSprint = useMutation({
    mutationFn: (name: string) => api.sprints.create({ name }),
    onSuccess: (sprint) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprints });
      setSprintId(sprint.id);
    },
  });

  const createTask = useMutation({
    mutationFn: () => api.tasks.create({ sprintId: activeSprintId, title: newTitle }),
    onSuccess: () => {
      setNewTitle('');
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <>
      <PageHeader title="Board">
        <select
          value={activeSprintId ?? ''}
          onChange={(e) => setSprintId(e.target.value || undefined)}
          aria-label="Sprint"
          className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 text-sm"
        >
          {sprints?.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt('Sprint name?');
            if (name) createSprint.mutate(name);
          }}
          className="border-edge text-ink-muted hover:text-ink rounded-control border px-2.5 py-1.5 text-sm transition-colors"
        >
          New sprint
        </button>
      </PageHeader>

      {activeSprintId ? (
        <>
          <form
            className="flex gap-2 px-4 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTitle.trim()) createTask.mutate();
            }}
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a story to the backlog…"
              aria-label="New story title"
              className="border-edge bg-surface text-ink rounded-control flex-1 border px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={!newTitle.trim() || createTask.isPending}
              className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              Add story
            </button>
          </form>

          <KanbanBoard
            tasks={tasks ?? []}
            agentNames={agentNames}
            onMove={(taskId, status) => move.mutate({ taskId, status })}
            onOpen={setOpenTaskId}
            onDragStateChange={setDragging}
          />
        </>
      ) : (
        <EmptyState
          message="No sprints yet — create one to start planning."
          hint="Stories live in sprints; agents and humans work them side by side."
        />
      )}

      {openTaskId ? (
        <TaskDrawer taskId={openTaskId} agents={agents ?? []} onClose={() => setOpenTaskId(null)} />
      ) : null}
    </>
  );
}

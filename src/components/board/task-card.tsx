'use client';

import { useDraggable } from '@dnd-kit/core';

import type { TaskItem } from '@/lib/api';

export function TaskCard({
  task,
  agentName,
  onOpen,
}: {
  task: TaskItem;
  agentName?: string;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const agentWorking = task.status === 'in_progress' && task.assigneeAgentId !== null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`border-edge bg-surface rounded-panel shadow-panel cursor-grab border p-2.5 transition-colors ${
        isDragging ? 'border-accent-500 z-10 opacity-90' : 'hover:border-accent-500/40'
      }`}
    >
      <p className="text-ink text-sm leading-snug">{task.title}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {task.points != null ? (
          <span className="bg-surface-muted text-ink-muted rounded-control px-1.5 py-0.5 font-mono text-[11px]">
            {task.points} pt
          </span>
        ) : null}
        {task.assigneeAgentId ? (
          <span
            className={`rounded-control flex items-center gap-1 px-1.5 py-0.5 text-[11px] ${
              agentWorking ? 'bg-accent-600/15 text-accent-500' : 'bg-surface-muted text-ink-muted'
            }`}
          >
            {agentWorking ? (
              <span className="bg-accent-500 size-1.5 animate-pulse rounded-full" aria-hidden />
            ) : null}
            🤖 {agentName ?? 'agent'}
          </span>
        ) : task.assigneeUserId ? (
          <span className="bg-surface-muted text-ink-muted rounded-control px-1.5 py-0.5 text-[11px]">
            you
          </span>
        ) : null}
      </div>
    </div>
  );
}

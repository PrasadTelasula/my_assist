'use client';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import type { TaskItem, TaskStatus } from '@/lib/api';

import { TaskCard } from './task-card';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

function Column({
  status,
  label,
  tasks,
  agentNames,
  onOpen,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskItem[];
  agentNames: Map<string, string>;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-panel flex min-h-40 flex-1 flex-col gap-2 p-2 transition-colors ${
        isOver
          ? 'bg-accent-600/5 outline-accent-500/40 outline-2 outline-dashed'
          : 'bg-surface-muted'
      }`}
    >
      <h3 className="text-ink-faint px-1 text-[11px] font-medium tracking-wide uppercase">
        {label} <span className="font-mono">({tasks.length})</span>
      </h3>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          agentName={task.assigneeAgentId ? agentNames.get(task.assigneeAgentId) : undefined}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

export function KanbanBoard({
  tasks,
  agentNames,
  onMove,
  onOpen,
  onDragStateChange,
}: {
  tasks: TaskItem[];
  agentNames: Map<string, string>;
  onMove: (taskId: string, status: TaskStatus) => void;
  onOpen: (id: string) => void;
  onDragStateChange: (dragging: boolean) => void;
}) {
  // A small distance threshold keeps plain clicks (open drawer) out of the drag sensor.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    onDragStateChange(false);
    const target = event.over?.id;
    if (!target) return;
    const task = tasks.find((t) => t.id === event.active.id);
    if (task && task.status !== target) onMove(task.id, target as TaskStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => onDragStateChange(true)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 p-4">
        {COLUMNS.map(({ status, label }) => (
          <Column
            key={status}
            status={status}
            label={label}
            tasks={tasks.filter((t) => t.status === status)}
            agentNames={agentNames}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  );
}

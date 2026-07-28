import { asc, desc, eq, max } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { type Sprint, sprints, type Task, taskActivity, tasks } from '@/server/db/schema';

export async function createSprint(input: {
  name: string;
  goal?: string;
  criticAgentId?: string | null;
}): Promise<Sprint> {
  const [sprint] = await db.insert(sprints).values(input).returning();
  return sprint!;
}

export async function listSprints(): Promise<Sprint[]> {
  return db.query.sprints.findMany({ orderBy: desc(sprints.createdAt) });
}

export async function updateSprint(
  id: string,
  input: Partial<{ name: string; goal: string; criticAgentId: string | null }>,
): Promise<Sprint | null> {
  const [sprint] = await db.update(sprints).set(input).where(eq(sprints.id, id)).returning();
  return sprint ?? null;
}

export async function createTask(input: {
  sprintId?: string | null;
  title: string;
  description?: string;
  points?: number | null;
}): Promise<Task> {
  const [row] = await db.select({ maxOrder: max(tasks.sortOrder) }).from(tasks);
  const sortOrder = (Number(row?.maxOrder ?? 0) + 1000).toString();
  const [task] = await db
    .insert(tasks)
    .values({ ...input, sortOrder })
    .returning();
  return task!;
}

export async function listTasks(sprintId?: string): Promise<Task[]> {
  return db.query.tasks.findMany({
    where: sprintId ? eq(tasks.sprintId, sprintId) : undefined,
    orderBy: asc(tasks.sortOrder),
  });
}

interface TaskPatch {
  title?: string;
  description?: string;
  points?: number | null;
  status?: Task['status'];
  sortOrder?: number;
  sprintId?: string | null;
  assigneeUserId?: string | null;
  assigneeAgentId?: string | null;
}

/** Applies a patch and records status transitions (velocity data) as activity. */
export async function updateTask(taskId: string, patch: TaskPatch): Promise<Task | null> {
  const current = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!current) return null;

  const statusChanged = patch.status !== undefined && patch.status !== current.status;
  const [updated] = await db
    .update(tasks)
    .set({
      ...patch,
      sortOrder: patch.sortOrder?.toString(),
      updatedAt: new Date(),
      ...(statusChanged ? { statusChangedAt: new Date() } : {}),
    })
    .where(eq(tasks.id, taskId))
    .returning();

  if (statusChanged) {
    await db.insert(taskActivity).values({
      taskId,
      kind: 'status_change',
      body: `Status: ${current.status} → ${patch.status}`,
      meta: { from: current.status, to: patch.status },
    });
  }
  return updated ?? null;
}

export async function listTaskActivity(taskId: string) {
  return db.query.taskActivity.findMany({
    where: eq(taskActivity.taskId, taskId),
    orderBy: asc(taskActivity.id),
  });
}

export async function addComment(taskId: string, body: string, actorUserId: string) {
  const [entry] = await db
    .insert(taskActivity)
    .values({ taskId, kind: 'comment', body, actorUserId })
    .returning();
  return entry!;
}

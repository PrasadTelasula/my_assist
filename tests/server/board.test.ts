import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { registerFakeModel } from '@/core/model-registry';
import { createSprint, createTask, updateTask } from '@/server/board';
import { assignAgentToTask } from '@/server/task-runs';
import { db } from '@/server/db/client';
import { agents, runEvents, runs, sprints, taskActivity, tasks } from '@/server/db/schema';
import { getCurrentUser } from '@/server/db/seed-user';

import { scriptedModel } from '../fixtures/scripted-model';

async function fakeAgent(name = 'Worker') {
  const [agent] = await db
    .insert(agents)
    .values({ name, systemPrompt: 'work the ticket', modelProvider: 'fake', modelId: 'scripted' })
    .returning();
  return agent!;
}

describe('board', () => {
  beforeEach(async () => {
    await db.delete(taskActivity);
    await db.delete(runEvents);
    await db.delete(runs);
    await db.delete(tasks);
    await db.delete(sprints);
  });

  it('rejects a task assigned to both a human and an agent', async () => {
    const agent = await fakeAgent();
    const user = await getCurrentUser();
    const sprint = await createSprint({ name: 'S1' });
    const task = await createTask({ sprintId: sprint.id, title: 'double', points: 1 });

    const failure = await db
      .update(tasks)
      .set({ assigneeUserId: user.id, assigneeAgentId: agent.id })
      .where(eq(tasks.id, task.id))
      .then(() => null)
      .catch((err: Error) => err);
    expect(failure).not.toBeNull();
    expect(String((failure as Error).cause ?? failure)).toMatch(/tasks_single_assignee_check/);
  });

  it('assigning an agent moves the card to in_progress and starts a task run', async () => {
    registerFakeModel(() =>
      scriptedModel([
        { toolCalls: [{ toolName: 'post_update', input: { message: 'Starting on it.' } }] },
        {
          toolCalls: [{ toolName: 'complete_task', input: { summary: 'Shipped the thing.' } }],
        },
        { text: 'All wrapped up.' },
      ]),
    );
    const agent = await fakeAgent();
    const sprint = await createSprint({ name: 'S1' });
    const task = await createTask({ sprintId: sprint.id, title: 'Build the widget', points: 3 });

    const { runId, done } = (await assignAgentToTask(task.id, agent.id))!;
    const midRun = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    expect(midRun!.status).toBe('in_progress');
    expect(midRun!.assigneeAgentId).toBe(agent.id);

    await done;

    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    expect(run!.trigger).toBe('task');
    expect(run!.taskId).toBe(task.id);
    expect(run!.status).toBe('succeeded');

    const after = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    expect(after!.status).toBe('review');

    const activity = await db.query.taskActivity.findMany({
      where: eq(taskActivity.taskId, task.id),
      orderBy: (a, { asc }) => asc(a.id),
    });
    const kinds = activity.map((a) => a.kind);
    expect(kinds).toContain('assignment');
    expect(kinds).toContain('agent_update');
    expect(kinds.filter((k) => k === 'status_change').length).toBeGreaterThanOrEqual(2);
    expect(activity.find((a) => a.kind === 'agent_update')!.body).toBe('Starting on it.');
  });

  it('flag_blocked leaves the card in progress with a blocked note', async () => {
    registerFakeModel(() =>
      scriptedModel([
        { toolCalls: [{ toolName: 'flag_blocked', input: { reason: 'Missing API docs' } }] },
        { text: 'Flagged.' },
      ]),
    );
    const agent = await fakeAgent();
    const sprint = await createSprint({ name: 'S1' });
    const task = await createTask({ sprintId: sprint.id, title: 'Blocked story' });

    const { done } = (await assignAgentToTask(task.id, agent.id))!;
    await done;

    const after = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    expect(after!.status).toBe('in_progress');
    const blocked = await db.query.taskActivity.findMany({
      where: eq(taskActivity.taskId, task.id),
    });
    expect(blocked.some((a) => a.kind === 'blocked' && a.body.includes('Missing API docs'))).toBe(
      true,
    );
  });

  it('a run that ends without complete_task posts a fallback note', async () => {
    registerFakeModel(() => scriptedModel([{ text: 'I looked at it but forgot to finish.' }]));
    const agent = await fakeAgent();
    const sprint = await createSprint({ name: 'S1' });
    const task = await createTask({ sprintId: sprint.id, title: 'Forgetful' });

    const { done } = (await assignAgentToTask(task.id, agent.id))!;
    await done;

    const after = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    expect(after!.status).toBe('in_progress');
    const notes = await db.query.taskActivity.findMany({ where: eq(taskActivity.taskId, task.id) });
    expect(notes.some((a) => a.kind === 'agent_update' && /without completing/i.test(a.body))).toBe(
      true,
    );
  });

  it('status changes record transitions for future velocity views', async () => {
    const sprint = await createSprint({ name: 'S1' });
    const task = await createTask({ sprintId: sprint.id, title: 'Move me' });
    await updateTask(task.id, { status: 'in_progress' });
    await updateTask(task.id, { status: 'done' });

    const changes = await db.query.taskActivity.findMany({
      where: eq(taskActivity.taskId, task.id),
    });
    const transitions = changes.filter((a) => a.kind === 'status_change').map((a) => a.meta);
    expect(transitions).toContainEqual({ from: 'backlog', to: 'in_progress' });
    expect(transitions).toContainEqual({ from: 'in_progress', to: 'done' });
  });
});

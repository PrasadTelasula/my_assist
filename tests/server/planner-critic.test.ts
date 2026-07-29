import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { registerFakeModel } from '@/core/model-registry';
import { createSprint, createTask } from '@/server/board';
import { db } from '@/server/db/client';
import { agents, runs, taskActivity, tasks } from '@/server/db/schema';
import { planSprintFromGoal } from '@/server/planner';
import { assignAgentToTask } from '@/server/task-runs';

import { resetDomainTables } from '../fixtures/reset-db';
import { scriptedModel } from '../fixtures/scripted-model';

async function fakeAgent(name: string) {
  const [agent] = await db
    .insert(agents)
    .values({ name, systemPrompt: 'do the job', modelProvider: 'fake', modelId: 'scripted' })
    .returning();
  return agent!;
}

describe('planner and critic', () => {
  beforeEach(async () => {
    await resetDomainTables();
  });

  it('planner run decomposes a goal into backlog stories', async () => {
    registerFakeModel(() =>
      scriptedModel([
        {
          toolCalls: [
            {
              toolName: 'create_story',
              input: { title: 'Set up schema', description: 'Tables and migrations', points: 3 },
            },
            {
              toolName: 'create_story',
              input: { title: 'Build API', description: 'CRUD endpoints', points: 5 },
            },
          ],
        },
        { toolCalls: [{ toolName: 'finish_planning', input: { summary: '2 stories planned' } }] },
        { text: 'Planning complete.' },
      ]),
    );
    const planner = await fakeAgent('Planner');
    const sprint = await createSprint({ name: 'Sprint A', goal: 'Ship the widget service' });

    const { done } = (await planSprintFromGoal(sprint.id, 'Ship the widget service', planner.id))!;
    await done;

    const stories = await db.query.tasks.findMany({ where: eq(tasks.sprintId, sprint.id) });
    expect(stories).toHaveLength(2);
    expect(stories.every((s) => s.status === 'backlog')).toBe(true);
    expect(stories.map((s) => s.points).toSorted()).toEqual([3, 5]);

    const planRuns = await db.query.runs.findMany({ where: eq(runs.trigger, 'plan') });
    expect(planRuns).toHaveLength(1);
    expect(planRuns[0]!.status).toBe('succeeded');
  });

  it('a critic reviews the card when it reaches Review, once per working run', async () => {
    let call = 0;
    registerFakeModel(() => {
      call += 1;
      // First resolution = worker run, second = critic run.
      return call === 1
        ? scriptedModel([
            { toolCalls: [{ toolName: 'complete_task', input: { summary: 'Implemented.' } }] },
            { text: 'Done.' },
          ])
        : scriptedModel([
            {
              toolCalls: [
                {
                  toolName: 'post_review',
                  input: { verdict: 'request_changes', findings: 'Missing tests for edge cases.' },
                },
              ],
            },
            { text: 'Review posted.' },
          ]);
    });

    const worker = await fakeAgent('Worker');
    const critic = await fakeAgent('Critic');
    const sprint = await createSprint({ name: 'S', criticAgentId: critic.id });
    const task = await createTask({ sprintId: sprint.id, title: 'Reviewed story' });

    const { done } = (await assignAgentToTask(task.id, worker.id))!;
    await done;
    // The critic run is started from the worker's terminal hook; let it drain.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const after = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    expect(after!.status).toBe('review');

    const reviews = await db.query.taskActivity.findMany({
      where: and(eq(taskActivity.taskId, task.id), eq(taskActivity.kind, 'review')),
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.body).toContain('Missing tests');
    expect(reviews[0]!.meta).toMatchObject({ verdict: 'request_changes' });
    expect(reviews[0]!.actorAgentId).toBe(critic.id);

    const criticRuns = await db.query.runs.findMany({ where: eq(runs.trigger, 'critic') });
    expect(criticRuns).toHaveLength(1);
  });

  it('no critic configured means no critic run', async () => {
    registerFakeModel(() =>
      scriptedModel([
        { toolCalls: [{ toolName: 'complete_task', input: { summary: 'Implemented.' } }] },
        { text: 'Done.' },
      ]),
    );
    const worker = await fakeAgent('Worker');
    const sprint = await createSprint({ name: 'S' });
    const task = await createTask({ sprintId: sprint.id, title: 'Unreviewed story' });

    const { done } = (await assignAgentToTask(task.id, worker.id))!;
    await done;
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(await db.query.runs.findMany({ where: eq(runs.trigger, 'critic') })).toHaveLength(0);
  });
});

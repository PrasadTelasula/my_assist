import { eq } from 'drizzle-orm';

import type { RuntimeTool } from '@/core/loop';
import { db } from '@/server/db/client';
import { agents, sprints, taskActivity, tasks } from '@/server/db/schema';
import { runManager } from '@/server/runs/run-manager';

const CRITIC_PREAMBLE = `
You are reviewing a task another agent just moved to Review. Read the card and
its activity trail, judge whether the work described actually satisfies the
task, and call post_review exactly once: verdict 'approve' if it holds up,
'request_changes' with concrete findings if not. The human makes the final
call — your review is advice, so be specific and brief.`;

function criticTools(taskId: string, criticAgentId: string) {
  return (runId: string): RuntimeTool[] => [
    {
      name: 'post_review',
      description: 'Post your review verdict and findings on the task.',
      inputSchema: {
        type: 'object',
        properties: {
          verdict: { type: 'string', enum: ['approve', 'request_changes'] },
          findings: { type: 'string', description: 'Specific observations backing the verdict' },
        },
        required: ['verdict', 'findings'],
      },
      toolVersionId: null,
      execute: async (input) => {
        const { verdict, findings } = input as { verdict: string; findings: string };
        await db.insert(taskActivity).values({
          taskId,
          kind: 'review',
          body: findings,
          actorAgentId: criticAgentId,
          runId,
          meta: { verdict },
        });
        return { output: 'Review posted.' };
      },
    },
  ];
}

/**
 * One critic pass per working run: called from the worker run's terminal hook
 * after complete_task moved the card to Review. No-op without a sprint critic.
 */
export async function startCriticReview(taskId: string): Promise<void> {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task || task.status !== 'review' || !task.sprintId) return;
  const sprint = await db.query.sprints.findFirst({ where: eq(sprints.id, task.sprintId) });
  if (!sprint?.criticAgentId) return;
  const critic = await db.query.agents.findFirst({ where: eq(agents.id, sprint.criticAgentId) });
  if (!critic) return;

  const activity = await db.query.taskActivity.findMany({
    where: eq(taskActivity.taskId, taskId),
    orderBy: (a, { asc }) => asc(a.id),
  });
  const trail = activity.map((a) => `- [${a.kind}] ${a.body}`).join('\n');

  await runManager.startRun({
    trigger: 'critic',
    agent: critic,
    taskId,
    inputText: `${CRITIC_PREAMBLE}\n\n# Task: ${task.title}\n${task.description}\n\nActivity trail:\n${trail}`,
    history: [],
    extraTools: criticTools(taskId, critic.id),
  });
}

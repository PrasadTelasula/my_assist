import { eq } from 'drizzle-orm';

import type { RuntimeTool } from '@/core/loop';
import { createTask } from '@/server/board';
import { db } from '@/server/db/client';
import { agents, sprints, taskActivity } from '@/server/db/schema';
import { runManager, type StartedRun } from '@/server/runs/run-manager';

const PLANNER_PREAMBLE = `
You are planning a sprint. Decompose the goal below into small, independently
deliverable stories. Create each one with create_story (a concise title, a
description with enough context for someone who has not seen this goal, and
story points: 1, 2, 3, 5, or 8). When the backlog covers the goal, call
finish_planning with a one-line summary.`;

function plannerTools(sprintId: string, agentId: string) {
  return (runId: string): RuntimeTool[] => [
    {
      name: 'create_story',
      description: 'Add one story to the sprint backlog.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Concise story title' },
          description: { type: 'string', description: 'Context and acceptance criteria' },
          points: { type: 'integer', description: 'Story points (1, 2, 3, 5, 8)' },
        },
        required: ['title', 'description'],
      },
      toolVersionId: null,
      execute: async (input) => {
        const { title, description, points } = input as {
          title: string;
          description: string;
          points?: number;
        };
        const task = await createTask({ sprintId, title, description, points: points ?? null });
        await db.insert(taskActivity).values({
          taskId: task.id,
          kind: 'agent_update',
          body: 'Story created by sprint planning',
          actorAgentId: agentId,
          runId,
        });
        return { output: `Story created: ${title}` };
      },
    },
    {
      name: 'finish_planning',
      description: 'Declare the backlog complete for this goal, with a summary.',
      inputSchema: {
        type: 'object',
        properties: { summary: { type: 'string', description: 'One-line planning summary' } },
        required: ['summary'],
      },
      toolVersionId: null,
      execute: async () => ({ output: 'Planning recorded. Wrap up your reply.' }),
    },
  ];
}

/** "Plan sprint from goal": an agent run that fills the backlog for human curation. */
export async function planSprintFromGoal(
  sprintId: string,
  goal: string,
  agentId: string,
): Promise<StartedRun | null> {
  const sprint = await db.query.sprints.findFirst({ where: eq(sprints.id, sprintId) });
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!sprint || !agent) return null;

  await db.update(sprints).set({ goal }).where(eq(sprints.id, sprintId));

  return runManager.startRun({
    trigger: 'plan',
    agent,
    inputText: `${PLANNER_PREAMBLE}\n\nSprint: ${sprint.name}\nGoal: ${goal}`,
    history: [],
    extraTools: plannerTools(sprintId, agentId),
  });
}

import { eq } from 'drizzle-orm';

import type { RuntimeTool } from '@/core/loop';
import { updateTask } from '@/server/board';
import { startCriticReview } from '@/server/critic';
import { db } from '@/server/db/client';
import { agents, sprints, taskActivity, type Task, tasks } from '@/server/db/schema';
import { runManager, type StartedRun } from '@/server/runs/run-manager';

const TASK_HARNESS_PREAMBLE = `
You are working a scrum board task assigned to you. Work it to completion using
your tools. Post progress with post_update. When the work is finished, call
complete_task with a summary — that moves the card to Review for a human.
If you cannot proceed, call flag_blocked with the reason.`;

async function renderTaskCard(task: Task): Promise<string> {
  const sprint = task.sprintId
    ? await db.query.sprints.findFirst({ where: eq(sprints.id, task.sprintId) })
    : null;
  const recent = await db.query.taskActivity.findMany({
    where: eq(taskActivity.taskId, task.id),
    orderBy: (a, { desc }) => desc(a.id),
    limit: 10,
  });
  return [
    `# Task: ${task.title}`,
    task.points != null ? `Points: ${task.points}` : null,
    sprint ? `Sprint: ${sprint.name}${sprint.goal ? ` — goal: ${sprint.goal}` : ''}` : null,
    task.description ? `\n${task.description}` : null,
    recent.length
      ? `\nRecent activity (newest first):\n${recent.map((a) => `- [${a.kind}] ${a.body}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function makeTaskTools(taskId: string, agentId: string, state: { completed: boolean }) {
  return (runId: string): RuntimeTool[] => {
    const activity = (kind: 'agent_update' | 'blocked', body: string) =>
      db.insert(taskActivity).values({ taskId, kind, body, actorAgentId: agentId, runId });

    return [
      {
        name: 'post_update',
        description: 'Post a progress update to the task card for humans to read.',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string', description: 'The progress update' } },
          required: ['message'],
        },
        toolVersionId: null,
        execute: async (input) => {
          await activity('agent_update', (input as { message: string }).message);
          return { output: 'Update posted.' };
        },
      },
      {
        name: 'complete_task',
        description:
          'Mark the task finished with a summary of what was done. Moves the card to Review.',
        inputSchema: {
          type: 'object',
          properties: { summary: { type: 'string', description: 'What was accomplished' } },
          required: ['summary'],
        },
        toolVersionId: null,
        execute: async (input) => {
          state.completed = true;
          await activity('agent_update', (input as { summary: string }).summary);
          await updateTask(taskId, { status: 'review' });
          return { output: 'Task moved to Review. Wrap up your reply.' };
        },
      },
      {
        name: 'flag_blocked',
        description: 'Flag that you cannot proceed, with the reason. The card stays In Progress.',
        inputSchema: {
          type: 'object',
          properties: { reason: { type: 'string', description: 'Why you are blocked' } },
          required: ['reason'],
        },
        toolVersionId: null,
        execute: async (input) => {
          await activity('blocked', (input as { reason: string }).reason);
          return { output: 'Blocker recorded.' };
        },
      },
    ];
  };
}

/**
 * The assign-to-agent flow: card → In Progress, then an autonomous run works
 * the ticket with task-scoped tools. Returns null if the task/agent is gone.
 */
export async function assignAgentToTask(
  taskId: string,
  agentId: string,
): Promise<StartedRun | null> {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!task || !agent) return null;

  await updateTask(taskId, { assigneeAgentId: agentId, assigneeUserId: null });
  await db.insert(taskActivity).values({
    taskId,
    kind: 'assignment',
    body: `Assigned to agent ${agent.name}`,
    actorAgentId: agentId,
  });

  if (task.status !== 'backlog' && task.status !== 'in_progress') return null;
  if (task.status === 'backlog') await updateTask(taskId, { status: 'in_progress' });

  const state = { completed: false };
  return runManager.startRun({
    trigger: 'task',
    agent,
    taskId,
    inputText: `${TASK_HARNESS_PREAMBLE}\n\n${await renderTaskCard({ ...task, status: 'in_progress' })}`,
    history: [],
    extraTools: makeTaskTools(taskId, agentId, state),
    onTerminal: async (runId, event) => {
      if (event.type === 'run_finished' && state.completed) {
        // One critic pass per working run, after the worker has fully finished.
        await startCriticReview(taskId);
      }
      if (event.type === 'run_finished' && !state.completed) {
        await db.insert(taskActivity).values({
          taskId,
          kind: 'agent_update',
          body: `Run ended without completing the task: ${event.finalText || '(no summary)'}`,
          actorAgentId: agentId,
          runId,
        });
      } else if (event.type === 'run_error') {
        await db.insert(taskActivity).values({
          taskId,
          kind: 'blocked',
          body: `Run failed (${event.reason}): ${event.message}`,
          actorAgentId: agentId,
          runId,
        });
      }
    },
  });
}

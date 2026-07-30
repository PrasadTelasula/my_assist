import { eq, inArray } from 'drizzle-orm';

import type { ModelRef } from '@/core/events';
import { runAgentLoop, type RuntimeTool, type ToolMode } from '@/core/loop';
import { db } from '@/server/db/client';
import { type Agent, messages, type RunPinned, runs } from '@/server/db/schema';
import { resolveAgentModel } from '@/server/providers';
import { appendRunEvent } from '@/server/runs/event-store';
import { userToolsForAgent } from '@/server/tools';

interface StartRunSpec {
  trigger: 'chat' | 'task' | 'manual' | 'plan' | 'critic';
  agent: Agent;
  threadId?: string;
  taskId?: string;
  inputText: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  /** Trigger-scoped tools (e.g. task tools) built once the run id exists. */
  extraTools?: (runId: string) => RuntimeTool[];
  /** Post-terminal hook for trigger-specific follow-up (e.g. board notes). */
  onTerminal?: (runId: string, event: TerminalEvent) => Promise<void>;
}

type TerminalEvent = Extract<
  import('@/core/events').AgentEvent,
  { type: 'run_finished' } | { type: 'run_error' }
>;

export interface StartedRun {
  runId: string;
  /** Resolves when the background run finishes. Routes ignore it; tests await it. */
  done: Promise<void>;
}

class RunManager {
  private active = new Map<string, AbortController>();

  async startRun(spec: StartRunSpec): Promise<StartedRun> {
    const { agent } = spec;
    // Resolved once: the run is pinned to this model for its whole lifetime.
    const { modelRef, model, toolMode } = await resolveAgentModel(agent);
    // Only what the user attached — nothing is injected behind their back.
    const tools = await userToolsForAgent(agent.id);
    const pinned: RunPinned = {
      systemPrompt: agent.systemPrompt,
      model: modelRef,
      tools: tools.map((t) => ({ name: t.name, toolVersionId: t.toolVersionId })),
    };

    const [run] = await db
      .insert(runs)
      .values({
        agentId: agent.id,
        threadId: spec.threadId,
        taskId: spec.taskId,
        trigger: spec.trigger,
        status: 'running',
        pinned,
        inputText: spec.inputText,
      })
      .returning();
    const runId = run!.id;

    const controller = new AbortController();
    this.active.set(runId, controller);

    const allTools = [...tools, ...(spec.extraTools?.(runId) ?? [])];
    const done = this.driveRun({
      runId,
      spec,
      modelRef,
      model,
      toolMode,
      tools: allTools,
      signal: controller.signal,
    }).catch(async (err) => {
      await db
        .update(runs)
        .set({
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          finishedAt: new Date(),
        })
        .where(eq(runs.id, runId));
    });

    return { runId, done };
  }

  abortRun(runId: string): boolean {
    const controller = this.active.get(runId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  /** Runs live in this process; any 'running' row at boot belongs to a dead server. */
  async sweepOrphanRuns(): Promise<void> {
    await db
      .update(runs)
      .set({ status: 'failed', error: 'orphaned (server restart)', finishedAt: new Date() })
      .where(inArray(runs.status, ['queued', 'running']));
  }

  private async driveRun(opts: {
    runId: string;
    spec: StartRunSpec;
    modelRef: ModelRef;
    model: Awaited<ReturnType<typeof resolveAgentModel>>['model'];
    toolMode: ToolMode;
    tools: RuntimeTool[];
    signal: AbortSignal;
  }): Promise<void> {
    const { runId, spec, modelRef, model, toolMode, tools, signal } = opts;
    const { agent } = spec;
    let seq = 0;
    const append = (event: Parameters<typeof appendRunEvent>[2]) =>
      appendRunEvent(runId, ++seq, event);

    try {
      await append({ type: 'run_started', model: modelRef, tools: tools.map((t) => t.name) });

      const loop = runAgentLoop({
        model,
        modelRef,
        system: agent.systemPrompt,
        messages: [
          ...spec.history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: spec.inputText },
        ],
        tools,
        toolMode,
        maxIterations: agent.maxIterations,
        costCeilingUsd: Number(agent.costCeilingUsd),
        signal,
      });

      for await (const event of loop) {
        await append(event);

        if (event.type === 'run_finished') {
          await db
            .update(runs)
            .set({
              status: 'succeeded',
              finalText: event.finalText,
              iterations: event.iterations,
              totalInputTokens: event.totals.inputTokens,
              totalOutputTokens: event.totals.outputTokens,
              totalCostUsd: event.totals.costUsd?.toFixed(6),
              finishedAt: new Date(),
            })
            .where(eq(runs.id, runId));
          if (spec.threadId) {
            await db.insert(messages).values({
              threadId: spec.threadId,
              role: 'assistant',
              content: event.finalText,
              runId,
            });
          }
          await spec.onTerminal?.(runId, event);
        } else if (event.type === 'run_error') {
          await db
            .update(runs)
            .set({
              status: event.reason === 'aborted' ? 'aborted' : 'failed',
              error: event.message,
              iterations: event.iteration + 1,
              totalInputTokens: event.totals.inputTokens,
              totalOutputTokens: event.totals.outputTokens,
              totalCostUsd: event.totals.costUsd?.toFixed(6),
              finishedAt: new Date(),
            })
            .where(eq(runs.id, runId));
          await spec.onTerminal?.(runId, event);
        }
      }
    } finally {
      this.active.delete(runId);
    }
  }
}

// globalThis-cached: dev HMR must not spawn a second manager with its own state.
// The flip side is that edits to this file need a dev-server restart to take
// effect — HMR swaps the module but the cached instance keeps the old methods.
const g = globalThis as unknown as { __runManager?: RunManager };
export const runManager = (g.__runManager ??= new RunManager());

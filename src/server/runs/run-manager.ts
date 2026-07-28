import { eq, inArray } from 'drizzle-orm';

import type { ModelRef } from '@/core/events';
import { runAgentLoop, type RuntimeTool } from '@/core/loop';
import { resolveModel } from '@/core/model-registry';
import { builtinTools } from '@/server/builtin-tools';
import { db } from '@/server/db/client';
import { type Agent, messages, type RunPinned, runs } from '@/server/db/schema';
import { appendRunEvent } from '@/server/runs/event-store';
import { userToolsForAgent } from '@/server/tools';

interface StartRunSpec {
  trigger: 'chat' | 'task' | 'manual' | 'plan' | 'critic';
  agent: Agent;
  threadId?: string;
  inputText: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface StartedRun {
  runId: string;
  /** Resolves when the background run finishes. Routes ignore it; tests await it. */
  done: Promise<void>;
}

const ENV_KEYS: Partial<Record<ModelRef['provider'], string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

class RunManager {
  private active = new Map<string, AbortController>();

  async startRun(spec: StartRunSpec): Promise<StartedRun> {
    const { agent } = spec;
    const modelRef: ModelRef = {
      provider: agent.modelProvider as ModelRef['provider'],
      modelId: agent.modelId,
    };
    const tools = [...builtinTools(), ...(await userToolsForAgent(agent.id))];
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
        trigger: spec.trigger,
        status: 'running',
        pinned,
        inputText: spec.inputText,
      })
      .returning();
    const runId = run!.id;

    const controller = new AbortController();
    this.active.set(runId, controller);

    const done = this.driveRun(runId, spec, modelRef, tools, controller.signal).catch(
      async (err) => {
        await db
          .update(runs)
          .set({
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            finishedAt: new Date(),
          })
          .where(eq(runs.id, runId));
      },
    );

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

  private async driveRun(
    runId: string,
    spec: StartRunSpec,
    modelRef: ModelRef,
    tools: RuntimeTool[],
    signal: AbortSignal,
  ): Promise<void> {
    const { agent } = spec;
    let seq = 0;
    const append = (event: Parameters<typeof appendRunEvent>[2]) =>
      appendRunEvent(runId, ++seq, event);

    try {
      await append({ type: 'run_started', model: modelRef });

      const envKey = ENV_KEYS[modelRef.provider];
      const model = resolveModel(modelRef, {
        apiKey: envKey ? process.env[envKey] : undefined,
        baseUrl: modelRef.provider === 'ollama' ? process.env.OLLAMA_BASE_URL : undefined,
      });

      const loop = runAgentLoop({
        model,
        modelRef,
        system: agent.systemPrompt,
        messages: [
          ...spec.history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: spec.inputText },
        ],
        tools,
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
        }
      }
    } finally {
      this.active.delete(runId);
    }
  }
}

// globalThis-cached: dev HMR must not spawn a second manager with its own state.
const g = globalThis as unknown as { __runManager?: RunManager };
export const runManager = (g.__runManager ??= new RunManager());

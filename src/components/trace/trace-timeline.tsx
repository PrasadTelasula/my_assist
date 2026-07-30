'use client';

import type { AgentEvent } from '@/core/events';
import type { TraceEvent } from '@/lib/use-run-events';

import { CostChip } from './cost-chip';
import { ToolCallCard } from './tool-call-card';

type ModelResponse = Extract<AgentEvent, { type: 'model_response' }>;
type ToolCall = Extract<AgentEvent, { type: 'tool_call' }>;
type ToolResult = Extract<AgentEvent, { type: 'tool_result' }>;
type RunFinished = Extract<AgentEvent, { type: 'run_finished' }>;
type RunError = Extract<AgentEvent, { type: 'run_error' }>;

interface Iteration {
  iteration: number;
  response?: ModelResponse;
  calls: { call: ToolCall; result?: ToolResult }[];
}

function groupByIteration(events: TraceEvent[]): {
  iterations: Iteration[];
  finished?: RunFinished;
  error?: RunError;
} {
  const iterations: Iteration[] = [];
  let finished: RunFinished | undefined;
  let error: RunError | undefined;

  for (const { event } of events) {
    switch (event.type) {
      case 'iteration_started':
        iterations.push({ iteration: event.iteration, calls: [] });
        break;
      case 'model_response':
        if (iterations[iterations.length - 1]) iterations[iterations.length - 1]!.response = event;
        break;
      case 'tool_call':
        iterations[iterations.length - 1]?.calls.push({ call: event });
        break;
      case 'tool_result': {
        const entry = iterations
          .flatMap((i) => i.calls)
          .find((c) => c.call.toolCallId === event.toolCallId);
        if (entry) entry.result = event;
        break;
      }
      case 'run_finished':
        finished = event;
        break;
      case 'run_error':
        error = event;
        break;
      case 'run_started':
        break;
    }
  }
  return { iterations, finished, error };
}

/**
 * The live view of a run: every iteration, model response, and tool call as
 * it happens. Shared by the chat side panel, run detail, and the task drawer.
 */
export function TraceTimeline({ events, live }: { events: TraceEvent[]; live: boolean }) {
  const { iterations, finished, error } = groupByIteration(events);

  if (events.length === 0) {
    return (
      <p className="text-ink-faint p-4 text-xs">
        {live ? 'Waiting for the first event…' : 'No trace recorded for this run.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="trace-timeline">
      {iterations.map(({ iteration, response, calls }) => (
        // The rail makes a multi-iteration run read as one thread, not a pile of boxes.
        <section
          key={iteration}
          className="border-edge relative flex flex-col gap-2 border-l pb-1 pl-4 last:border-transparent"
        >
          <span
            aria-hidden
            className="bg-accent-500 absolute top-1.5 -left-[3px] size-1.5 rounded-full"
          />
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
              Iteration {iteration + 1}
            </span>
            {response ? (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-faint font-mono text-[11px]">
                  {response.usage.inputTokens}→{response.usage.outputTokens} tok
                </span>
                <CostChip costUsd={response.costUsd} />
                <span className="text-ink-faint font-mono text-[11px]">{response.latencyMs}ms</span>
              </span>
            ) : (
              <span
                className="border-accent-500 size-3 animate-spin rounded-full border-2 border-t-transparent"
                role="status"
                aria-label="Model thinking"
              />
            )}
          </header>
          {response?.text ? (
            <p className="text-ink-muted border-edge bg-surface rounded-control border px-2.5 py-2 text-xs leading-relaxed">
              {response.text}
            </p>
          ) : null}
          {calls.map(({ call, result }) => (
            <ToolCallCard key={call.toolCallId} call={call} result={result} />
          ))}
        </section>
      ))}

      {finished ? (
        <footer className="border-edge text-ink-muted flex flex-wrap items-center gap-2 border-t pt-3 text-[11px]">
          <span className="font-medium">
            {finished.iterations} iteration{finished.iterations === 1 ? '' : 's'}
          </span>
          <span className="font-mono">
            {finished.totals.inputTokens}→{finished.totals.outputTokens} tok
          </span>
          <CostChip costUsd={finished.totals.costUsd} />
          <span className="font-mono">{(finished.totals.wallMs / 1000).toFixed(1)}s</span>
        </footer>
      ) : null}
      {error ? (
        <p className="rounded-control bg-destructive/10 text-destructive border-destructive/30 border px-2.5 py-2 text-xs">
          {error.reason.replace('_', ' ')}: {error.message}
        </p>
      ) : null}
    </div>
  );
}

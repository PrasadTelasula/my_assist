import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TraceTimeline } from '@/components/trace/trace-timeline';
import type { TraceEvent } from '@/lib/use-run-events';

const usage = { inputTokens: 10, outputTokens: 5 };

function traceFixture(): TraceEvent[] {
  return [
    { seq: 1, event: { type: 'run_started', model: { provider: 'fake', modelId: 's' } } },
    { seq: 2, event: { type: 'iteration_started', iteration: 0 } },
    {
      seq: 3,
      event: {
        type: 'model_response',
        iteration: 0,
        text: 'Checking the time.',
        usage,
        costUsd: 0.0012,
        latencyMs: 87,
        finishReason: 'tool-calls',
      },
    },
    {
      seq: 4,
      event: {
        type: 'tool_call',
        iteration: 0,
        toolCallId: 'tc_1',
        toolName: 'get_time',
        toolVersionId: null,
        input: {},
      },
    },
  ];
}

describe('TraceTimeline', () => {
  it('groups events by iteration and shows a pending spinner for unanswered tool calls', () => {
    render(<TraceTimeline events={traceFixture()} live />);

    expect(screen.getByText('Iteration 1')).toBeInTheDocument();
    expect(screen.getByText('Checking the time.')).toBeInTheDocument();
    expect(screen.getByText('get_time')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /get_time running/i })).toBeInTheDocument();
    expect(screen.getByText('$0.0012')).toBeInTheDocument();
  });

  it('replaces the spinner with the result and renders totals when finished', () => {
    const events: TraceEvent[] = [
      ...traceFixture(),
      {
        seq: 5,
        event: {
          type: 'tool_result',
          iteration: 0,
          toolCallId: 'tc_1',
          toolName: 'get_time',
          output: '2026-07-28T12:00:00Z',
          isError: false,
          durationMs: 3,
        },
      },
      { seq: 6, event: { type: 'iteration_started', iteration: 1 } },
      {
        seq: 7,
        event: {
          type: 'model_response',
          iteration: 1,
          text: 'It is noon UTC.',
          usage,
          costUsd: 0.001,
          latencyMs: 60,
          finishReason: 'stop',
        },
      },
      {
        seq: 8,
        event: {
          type: 'run_finished',
          iterations: 2,
          finalText: 'It is noon UTC.',
          totals: { inputTokens: 20, outputTokens: 10, costUsd: 0.0022, wallMs: 150 },
        },
      },
    ];
    render(<TraceTimeline events={events} live={false} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/2026-07-28T12:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText('Iteration 2')).toBeInTheDocument();
    expect(screen.getByText('2 iterations')).toBeInTheDocument();
    expect(screen.getByText('$0.0022')).toBeInTheDocument();
  });

  it('renders an error banner for failed runs', () => {
    const events: TraceEvent[] = [
      { seq: 1, event: { type: 'iteration_started', iteration: 0 } },
      {
        seq: 2,
        event: {
          type: 'run_error',
          reason: 'cost_ceiling',
          message: 'Run cost reached $1.20 (ceiling $1)',
          iteration: 0,
          totals: { inputTokens: 9, outputTokens: 9, costUsd: 1.2, wallMs: 500 },
        },
      },
    ];
    render(<TraceTimeline events={events} live={false} />);
    expect(screen.getByText(/cost ceiling/)).toBeInTheDocument();
    expect(screen.getByText(/Run cost reached/)).toBeInTheDocument();
  });
});

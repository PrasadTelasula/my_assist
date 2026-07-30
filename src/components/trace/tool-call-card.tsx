'use client';

import { useState } from 'react';

import type { AgentEvent } from '@/core/events';

type ToolCall = Extract<AgentEvent, { type: 'tool_call' }>;
type ToolResult = Extract<AgentEvent, { type: 'tool_result' }>;

function Json({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2) ?? String(value);
  const long = text.length > 400;
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <pre className="text-ink-muted overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {long && !expanded ? `${text.slice(0, 400)}…` : text}
      </pre>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-accent-600 mt-1 text-[11px] font-medium hover:underline"
        >
          {expanded ? 'Collapse' : `Show all ${text.length.toLocaleString()} chars`}
        </button>
      ) : null}
    </div>
  );
}

export function ToolCallCard({ call, result }: { call: ToolCall; result?: ToolResult }) {
  return (
    <div
      className={`rounded-control shadow-card border p-2.5 ${
        result?.isError ? 'border-destructive/40 bg-destructive/5' : 'border-edge bg-surface'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="bg-surface-muted text-ink rounded-control px-1.5 py-0.5 font-mono text-[11px] font-semibold">
          {call.toolName}
        </span>
        {result ? (
          <span className="text-ink-faint font-mono text-[11px]">{result.durationMs}ms</span>
        ) : (
          <span
            className="border-accent-500 size-3 animate-spin rounded-full border-2 border-t-transparent"
            role="status"
            aria-label={`${call.toolName} running`}
          />
        )}
      </div>
      <div className="mt-1.5">
        <Json value={call.input} />
      </div>
      {result ? (
        <div className="border-edge mt-2 border-t pt-2">
          {result.isError ? (
            <p className="text-destructive font-mono text-[11px]">{String(result.output)}</p>
          ) : (
            <Json value={result.output} />
          )}
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '@/lib/api';

export function ToolTestPanel({ toolId }: { toolId: string | null }) {
  const [args, setArgs] = useState('{}');

  const test = useMutation({
    mutationFn: async () => {
      if (!toolId) throw new Error('Save the tool before test-running it');
      return api.tools.testRun(toolId, JSON.parse(args));
    },
  });

  return (
    <aside className="border-edge bg-surface-muted flex w-80 shrink-0 flex-col gap-2 border-l p-3">
      <h3 className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">Test run</h3>
      <label htmlFor="test-args" className="text-ink-muted text-xs">
        Arguments (JSON)
      </label>
      <textarea
        id="test-args"
        value={args}
        onChange={(e) => setArgs(e.target.value)}
        rows={4}
        className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => test.mutate()}
        disabled={test.isPending || toolId === null}
        className="border-edge text-ink hover:border-accent-500 rounded-control border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
      >
        {test.isPending ? 'Running…' : 'Run in sandbox'}
      </button>
      {toolId === null ? (
        <p className="text-ink-faint text-xs">Create the tool first, then test it here.</p>
      ) : null}
      {test.data ? (
        <pre
          className={`rounded-control overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap ${
            test.data.ok ? 'bg-surface text-ink' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {test.data.ok
            ? JSON.stringify(test.data.result, null, 2)
            : `${test.data.error}${test.data.stderr ? `\n--- stderr ---\n${test.data.stderr}` : ''}`}
        </pre>
      ) : null}
      {test.isError ? (
        <p className="text-destructive text-xs">{(test.error as Error).message}</p>
      ) : null}
    </aside>
  );
}

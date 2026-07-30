'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/field';
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
    <aside className="border-edge bg-surface-muted flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l p-4">
      <h3 className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
        Test run
      </h3>
      <label htmlFor="test-args" className="text-ink text-xs font-medium">
        Arguments (JSON)
      </label>
      <TextArea
        id="test-args"
        value={args}
        onChange={(e) => setArgs(e.target.value)}
        rows={4}
        className="resize-none font-mono text-xs"
      />
      <Button
        type="button"
        onClick={() => test.mutate()}
        disabled={test.isPending || toolId === null}
      >
        {test.isPending ? 'Running…' : 'Run in sandbox'}
      </Button>
      {toolId === null ? (
        <p className="text-ink-faint text-xs leading-relaxed">
          Create the tool first, then test it here.
        </p>
      ) : null}
      {test.data ? (
        <pre
          className={`rounded-control border-edge overflow-x-auto border p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap ${
            test.data.ok
              ? 'bg-surface text-ink'
              : 'bg-destructive/10 text-destructive border-destructive/30'
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

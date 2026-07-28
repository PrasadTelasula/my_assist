'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { api, ToolSaveError, type ValidationIssue } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <p className="text-ink-faint p-4 text-xs">Loading editor…</p>,
});

const TOOL_BOILERPLATE = `// A tool is a schema plus a default async function.
// No imports are available except '@sandbox/std' (needs the network permission).

export const schema = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Text to process' },
  },
  required: ['text'],
};

export default async function run(input: { text: string }) {
  return { processed: input.text };
}
`;

interface MonacoLike {
  editor: {
    setModelMarkers: (model: unknown, owner: string, markers: unknown[]) => void;
  };
  MarkerSeverity: { Error: number };
}

export function ToolEditor({
  toolId,
  onCreated,
}: {
  toolId: string | null;
  onCreated: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(TOOL_BOILERPLATE);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowNet, setAllowNet] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [testArgs, setTestArgs] = useState('{}');
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const monacoRef = useRef<{ monaco: MonacoLike; editor: { getModel: () => unknown } } | null>(
    null,
  );

  const { data: tool } = useQuery({
    queryKey: queryKeys.tool(toolId ?? 'new'),
    queryFn: () => api.tools.get(toolId!),
    enabled: toolId !== null,
  });

  // Load the latest (or selected) version into the editor when switching tools.
  useEffect(() => {
    if (!tool) {
      setCode(TOOL_BOILERPLATE);
      setName('');
      setDescription('');
      setAllowNet(false);
      setViewingVersion(null);
      return;
    }
    const version =
      tool.versions.find((v) => v.id === (viewingVersion ?? tool.latestVersionId)) ??
      tool.versions[0];
    if (version) {
      setCode(version.tsCode);
      setAllowNet(version.permissions.net);
    }
    setName(tool.name);
    setDescription(tool.description);
  }, [tool, viewingVersion]);

  const applyMarkers = (nextIssues: ValidationIssue[]) => {
    setIssues(nextIssues);
    const handle = monacoRef.current;
    if (!handle) return;
    handle.monaco.editor.setModelMarkers(
      handle.editor.getModel(),
      'sandbox-validation',
      nextIssues.map((issue) => ({
        message: issue.message,
        severity: handle.monaco.MarkerSeverity.Error,
        startLineNumber: issue.line,
        startColumn: issue.column,
        endLineNumber: issue.line,
        endColumn: issue.column + 1,
      })),
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      const permissions = { net: allowNet };
      if (toolId) return api.tools.saveVersion(toolId, { tsCode: code, permissions });
      return api.tools.create({ name, description, tsCode: code, permissions });
    },
    onSuccess: (saved) => {
      applyMarkers([]);
      setViewingVersion(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tools });
      if (toolId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tool(toolId) });
      } else {
        onCreated((saved as { id: string }).id);
      }
    },
    onError: (err) => {
      if (err instanceof ToolSaveError) applyMarkers(err.issues);
    },
  });

  const test = useMutation({
    mutationFn: async () => {
      if (!toolId) throw new Error('Save the tool before test-running it');
      return api.tools.testRun(toolId, JSON.parse(testArgs));
    },
  });

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-edge flex items-center gap-2 border-b px-3 py-2">
          {toolId === null ? (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="tool_name"
                aria-label="Tool name"
                className="border-edge bg-surface text-ink rounded-control border px-2 py-1 font-mono text-sm"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the model reads to decide when to use it"
                aria-label="Tool description"
                className="border-edge bg-surface text-ink rounded-control flex-1 border px-2 py-1 text-sm"
              />
            </>
          ) : (
            <span className="text-ink flex-1 font-mono text-sm font-semibold">{tool?.name}</span>
          )}
          <label className="text-ink-muted flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={allowNet}
              onChange={(e) => setAllowNet(e.target.checked)}
              className="accent-accent-600"
            />
            network
          </label>
          {tool && tool.versions.length > 0 ? (
            <select
              value={viewingVersion ?? tool.latestVersionId ?? ''}
              onChange={(e) => setViewingVersion(e.target.value)}
              aria-label="Version"
              className="border-edge bg-surface text-ink-muted rounded-control border px-1.5 py-1 font-mono text-xs"
            >
              {tool.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                  {v.id === tool.latestVersionId ? ' (latest)' : ''}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || (toolId === null && !name)}
            className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : toolId ? 'Save as new version' : 'Create tool'}
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <MonacoEditor
            language="typescript"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value ?? '')}
            onMount={(editor, monaco) => {
              monacoRef.current = { editor, monaco: monaco as unknown as MonacoLike };
            }}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
          />
        </div>

        {issues.length > 0 ? (
          <ul className="border-edge bg-destructive/5 max-h-28 overflow-y-auto border-t px-3 py-2">
            {issues.map((issue, i) => (
              <li key={i} className="text-destructive font-mono text-xs">
                {issue.line}:{issue.column} {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <aside className="border-edge bg-surface-muted flex w-80 shrink-0 flex-col gap-2 border-l p-3">
        <h3 className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">Test run</h3>
        <label htmlFor="test-args" className="text-ink-muted text-xs">
          Arguments (JSON)
        </label>
        <textarea
          id="test-args"
          value={testArgs}
          onChange={(e) => setTestArgs(e.target.value)}
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
    </div>
  );
}

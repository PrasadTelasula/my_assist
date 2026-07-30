'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, TextInput } from '@/components/ui/field';
import { api, ToolSaveError } from '@/lib/api';
import { type ValidationIssue } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys';

import { ToolTestPanel } from './tool-test-panel';
import { useTheme } from '@/lib/use-theme';

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
  const theme = useTheme();
  const [code, setCode] = useState(TOOL_BOILERPLATE);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowNet, setAllowNet] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
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

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-edge bg-surface flex items-center gap-2 border-b px-4 py-2.5">
          {toolId === null ? (
            <>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="tool_name"
                aria-label="Tool name"
                className="w-48 font-mono"
              />
              <TextInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the model reads to decide when to use it"
                aria-label="Tool description"
                className="flex-1"
              />
            </>
          ) : (
            <span className="text-ink flex-1 font-mono text-sm font-semibold">{tool?.name}</span>
          )}
          <label className="text-ink-muted flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={allowNet}
              onChange={(e) => setAllowNet(e.target.checked)}
              className="accent-accent-600"
            />
            network
          </label>
          {tool && tool.versions.length > 0 ? (
            <Select
              value={viewingVersion ?? tool.latestVersionId ?? ''}
              onChange={(e) => setViewingVersion(e.target.value)}
              aria-label="Version"
              className="w-auto font-mono text-xs"
            >
              {tool.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                  {v.id === tool.latestVersionId ? ' (latest)' : ''}
                </option>
              ))}
            </Select>
          ) : null}
          <Button
            type="button"
            variant="primary"
            onClick={() => save.mutate()}
            disabled={save.isPending || (toolId === null && !name)}
          >
            {save.isPending ? 'Saving…' : toolId ? 'Save as new version' : 'Create tool'}
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          <MonacoEditor
            language="typescript"
            theme={theme === 'light' ? 'vs' : 'vs-dark'}
            value={code}
            onChange={(value) => setCode(value ?? '')}
            onMount={(editor, monaco) => {
              monacoRef.current = { editor, monaco: monaco as unknown as MonacoLike };
            }}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
          />
        </div>

        {issues.length > 0 ? (
          <ul className="border-edge bg-destructive/5 max-h-28 overflow-y-auto border-t px-4 py-2.5">
            {issues.map((issue, i) => (
              <li key={i} className="text-destructive font-mono text-xs leading-relaxed">
                {issue.line}:{issue.column} {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ToolTestPanel toolId={toolId} />
    </div>
  );
}

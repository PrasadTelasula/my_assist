'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useState } from 'react';

import { ToolEditor } from '@/components/editor/tool-editor';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export default function HarnessEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = use(params);
  const { data: agent } = useQuery({
    queryKey: queryKeys.agent(agentId),
    queryFn: () => api.agents.get(agentId),
  });
  const { data: tools } = useQuery({ queryKey: queryKeys.tools, queryFn: api.tools.list });
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader title={`Harness editor${agent ? ` — ${agent.name}` : ''}`}>
        <Link
          href={`/agents/${agentId}`}
          className="border-edge text-ink-muted hover:text-ink rounded-control border px-2.5 py-1.5 text-sm transition-colors"
        >
          Back to agent
        </Link>
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <nav className="border-edge bg-surface w-52 shrink-0 overflow-y-auto border-r p-2">
          <button
            type="button"
            onClick={() => setSelectedToolId(null)}
            className={`rounded-control w-full px-2.5 py-1.5 text-left text-sm transition-colors ${
              selectedToolId === null
                ? 'bg-accent-600/10 text-accent-500 font-medium'
                : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
            }`}
          >
            + New tool
          </button>
          {tools?.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setSelectedToolId(tool.id)}
              className={`rounded-control w-full px-2.5 py-1.5 text-left font-mono text-sm transition-colors ${
                selectedToolId === tool.id
                  ? 'bg-accent-600/10 text-accent-500 font-medium'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              {tool.name}
            </button>
          ))}
        </nav>

        <ToolEditor toolId={selectedToolId} onCreated={setSelectedToolId} />
      </div>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { CostChip } from '@/components/trace/cost-chip';
import { StatusBadge } from '@/components/trace/status-badge';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export default function RunsPage() {
  const { data: runs, isLoading } = useQuery({
    queryKey: queryKeys.runs,
    queryFn: api.runs.list,
    refetchInterval: 5000,
  });

  return (
    <>
      <PageHeader title="Runs" />
      {isLoading ? (
        <p className="text-ink-faint p-6 text-sm">Loading runs…</p>
      ) : runs?.length ? (
        <div className="overflow-x-auto p-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-ink-faint text-[11px] tracking-wide uppercase">
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium">Agent</th>
                <th className="px-2 py-1.5 font-medium">Input</th>
                <th className="px-2 py-1.5 font-medium">Iter</th>
                <th className="px-2 py-1.5 font-medium">Tokens</th>
                <th className="px-2 py-1.5 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-edge divide-y">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-surface transition-colors">
                  <td className="px-2 py-2">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="text-ink px-2 py-2">{run.agentName}</td>
                  <td className="text-ink-muted max-w-md truncate px-2 py-2">
                    <Link
                      href={`/runs/${run.id}`}
                      className="hover:text-accent-500 hover:underline"
                    >
                      {run.inputText}
                    </Link>
                  </td>
                  <td className="text-ink-muted px-2 py-2 font-mono text-xs">{run.iterations}</td>
                  <td className="text-ink-muted px-2 py-2 font-mono text-xs">
                    {run.totalInputTokens}→{run.totalOutputTokens}
                  </td>
                  <td className="px-2 py-2">
                    <CostChip costUsd={run.totalCostUsd} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          message="No runs yet — assign a task to an agent or start a chat."
          hint="Every run records its full trace: iterations, tool calls, tokens, cost."
        />
      )}
    </>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { CostChip } from '@/components/trace/cost-chip';
import { StatusBadge } from '@/components/trace/status-badge';
import { cardClass } from '@/components/ui/card';
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
        <div className="p-6">
          <div className={`${cardClass()} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted border-edge border-b">
                <tr className="text-ink-faint text-[11px] tracking-wider uppercase">
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Agent</th>
                  <th className="px-4 py-2.5 font-semibold">Input</th>
                  <th className="px-4 py-2.5 font-semibold">Iter</th>
                  <th className="px-4 py-2.5 font-semibold">Tokens</th>
                  <th className="px-4 py-2.5 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-edge divide-y">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-surface-muted transition-colors">
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="text-ink px-4 py-2.5 font-medium">{run.agentName}</td>
                    <td className="text-ink-muted max-w-md truncate px-4 py-2.5">
                      <Link
                        href={`/runs/${run.id}`}
                        className="hover:text-accent-600 hover:underline"
                      >
                        {run.inputText}
                      </Link>
                    </td>
                    <td className="text-ink-muted px-4 py-2.5 font-mono text-xs">
                      {run.iterations}
                    </td>
                    <td className="text-ink-muted px-4 py-2.5 font-mono text-xs">
                      {run.totalInputTokens}→{run.totalOutputTokens}
                    </td>
                    <td className="px-4 py-2.5">
                      <CostChip costUsd={run.totalCostUsd} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { CostChip } from '@/components/trace/cost-chip';
import { cardClass } from '@/components/ui/card';

interface OpsData {
  byAgent: {
    agentId: string;
    agentName: string;
    runCount: number;
    failures: number;
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
  }[];
  recentFailures: {
    id: string;
    agentName: string;
    trigger: string;
    error: string | null;
    startedAt: string;
  }[];
  activeRuns: number;
  providers: { provider: string; configured: boolean }[];
}

export default function OpsPage() {
  const { data } = useQuery<OpsData>({
    queryKey: ['ops'],
    queryFn: async () => {
      const response = await fetch('/api/ops');
      if (!response.ok) throw new Error(`GET /api/ops failed (${response.status})`);
      return response.json();
    },
    refetchInterval: 5000,
  });

  if (!data) {
    return (
      <>
        <PageHeader title="Ops" />
        <p className="text-ink-faint p-6 text-sm">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ops">
        <span className="bg-surface-muted text-ink-muted rounded-control px-2.5 py-1 text-xs">
          <span className="text-ink font-mono font-semibold">{data.activeRuns}</span> active run
          {data.activeRuns === 1 ? '' : 's'}
        </span>
      </PageHeader>

      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
        <section className={`${cardClass()} p-5`}>
          <h2 className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
            Providers
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.providers.map(({ provider, configured }) => (
              <span
                key={provider}
                className={`rounded-control px-2.5 py-1 font-mono text-xs ${
                  configured ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-faint'
                }`}
              >
                {provider} {configured ? '✓ key set' : '— no key'}
              </span>
            ))}
          </div>
        </section>

        <section className={`${cardClass()} p-5`}>
          <h2 className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
            Spend by agent
          </h2>
          {data.byAgent.length ? (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="text-ink-faint border-edge border-b text-[11px] tracking-wider uppercase">
                  <th className="py-2 pr-4 font-semibold">Agent</th>
                  <th className="py-2 pr-4 font-semibold">Runs</th>
                  <th className="py-2 pr-4 font-semibold">Failures</th>
                  <th className="py-2 pr-4 font-semibold">Tokens</th>
                  <th className="py-2 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-edge divide-y">
                {data.byAgent.map((row) => (
                  <tr key={row.agentId}>
                    <td className="text-ink py-2 pr-4 font-medium">{row.agentName}</td>
                    <td className="text-ink-muted py-2 pr-4 font-mono text-xs">{row.runCount}</td>
                    <td
                      className={`py-2 pr-4 font-mono text-xs ${row.failures > 0 ? 'text-destructive' : 'text-ink-muted'}`}
                    >
                      {row.failures}
                    </td>
                    <td className="text-ink-muted py-2 pr-4 font-mono text-xs">
                      {row.inputTokens ?? 0}→{row.outputTokens ?? 0}
                    </td>
                    <td className="py-2">
                      <CostChip costUsd={row.costUsd} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No runs recorded yet." hint="Spend rollups appear per agent." />
          )}
        </section>

        <section className={`${cardClass()} p-5`}>
          <h2 className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
            Recent failures
          </h2>
          {data.recentFailures.length ? (
            <ul className="divide-edge mt-1 flex flex-col divide-y">
              {data.recentFailures.map((failure) => (
                <li key={failure.id} className="py-2 text-xs">
                  <Link href={`/runs/${failure.id}`} className="hover:underline">
                    <span className="text-ink font-medium">{failure.agentName}</span>{' '}
                    <span className="text-ink-faint">({failure.trigger})</span>{' '}
                    <span className="text-destructive">{failure.error}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-faint mt-3 text-xs">None — clean slate.</p>
          )}
        </section>
      </div>
    </>
  );
}

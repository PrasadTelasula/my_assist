'use client';

import { useMutation } from '@tanstack/react-query';
import { use } from 'react';

import { PageHeader } from '@/components/shell/page-header';
import { TraceTimeline } from '@/components/trace/trace-timeline';
import { useRunEvents } from '@/lib/use-run-events';

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = use(params);
  const { events, live } = useRunEvents(runId);

  const abort = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/runs/${runId}/abort`, { method: 'POST' });
      if (!response.ok) throw new Error('Run is no longer active');
    },
  });

  return (
    <>
      <PageHeader title="Run trace">
        {live ? (
          <button
            type="button"
            onClick={() => abort.mutate()}
            disabled={abort.isPending}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-control border px-2.5 py-1.5 text-sm transition-colors disabled:opacity-50"
          >
            Abort run
          </button>
        ) : null}
      </PageHeader>
      <div className="mx-auto max-w-3xl">
        {abort.isError ? (
          <p className="text-destructive px-3 pt-3 text-xs">{(abort.error as Error).message}</p>
        ) : null}
        <TraceTimeline events={events} live={live} />
      </div>
    </>
  );
}

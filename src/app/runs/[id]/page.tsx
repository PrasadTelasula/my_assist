'use client';

import { useMutation } from '@tanstack/react-query';
import { use } from 'react';

import { PageHeader } from '@/components/shell/page-header';
import { TraceTimeline } from '@/components/trace/trace-timeline';
import { Button } from '@/components/ui/button';
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
          <Button
            type="button"
            variant="danger"
            onClick={() => abort.mutate()}
            disabled={abort.isPending}
          >
            Abort run
          </Button>
        ) : null}
      </PageHeader>
      <div className="mx-auto max-w-3xl p-6">
        {abort.isError ? (
          <p className="text-destructive pb-3 text-xs">{(abort.error as Error).message}</p>
        ) : null}
        <TraceTimeline events={events} live={live} />
      </div>
    </>
  );
}

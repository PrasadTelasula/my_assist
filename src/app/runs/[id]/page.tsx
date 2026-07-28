'use client';

import { use } from 'react';

import { PageHeader } from '@/components/shell/page-header';
import { TraceTimeline } from '@/components/trace/trace-timeline';
import { useRunEvents } from '@/lib/use-run-events';

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = use(params);
  const { events, live } = useRunEvents(runId);

  return (
    <>
      <PageHeader title="Run trace" />
      <div className="mx-auto max-w-3xl">
        <TraceTimeline events={events} live={live} />
      </div>
    </>
  );
}

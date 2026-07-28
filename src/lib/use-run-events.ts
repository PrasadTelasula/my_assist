'use client';

import { useEffect, useRef, useState } from 'react';

import { type AgentEvent, agentEventSchema } from '@/core/events';

export interface TraceEvent {
  seq: number;
  event: AgentEvent;
}

const EVENT_TYPES: AgentEvent['type'][] = [
  'run_started',
  'iteration_started',
  'model_response',
  'tool_call',
  'tool_result',
  'run_finished',
  'run_error',
];

/**
 * Streams a run's trace over SSE. The server replays history after
 * Last-Event-ID (native EventSource reconnect behavior), so late joins and
 * reconnects are lossless; events are deduped by seq.
 */
export function useRunEvents(runId: string | null): { events: TraceEvent[]; live: boolean } {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [live, setLive] = useState(false);
  const seen = useRef(new Set<number>());

  useEffect(() => {
    if (!runId) return;
    seen.current = new Set();
    setEvents([]);
    setLive(true);

    const source = new EventSource(`/api/runs/${runId}/events`);
    const onEvent = (message: MessageEvent) => {
      const seq = Number(message.lastEventId);
      if (seen.current.has(seq)) return;
      const parsed = agentEventSchema.safeParse(JSON.parse(message.data as string));
      if (!parsed.success) return;
      seen.current.add(seq);
      setEvents((prev) => [...prev, { seq, event: parsed.data }]);
    };
    const onDone = () => {
      setLive(false);
      source.close();
    };

    EVENT_TYPES.forEach((type) => source.addEventListener(type, onEvent));
    source.addEventListener('done', onDone);

    return () => {
      setLive(false);
      source.close();
    };
  }, [runId]);

  return { events, live };
}

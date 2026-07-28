import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { runs } from '@/server/db/schema';
import { listRunEventsAfter, runEventBus, type StoredRunEvent } from '@/server/runs/event-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TERMINAL_TYPES = new Set(['run_finished', 'run_error']);
const HEARTBEAT_MS = 15_000;

function sseChunk(event: StoredRunEvent): string {
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
}

/**
 * Live run trace: replays persisted events after Last-Event-ID, then attaches
 * to the in-process bus. Live events arriving during replay are buffered and
 * deduped by seq, so reconnects are lossless and gap-free.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: runId } = await context.params;

  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });

  const lastEventId = Number(
    request.headers.get('last-event-id') ??
      new URL(request.url).searchParams.get('lastEventId') ??
      0,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastSent = lastEventId;
      let replaying = true;
      const buffered: StoredRunEvent[] = [];
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, HEARTBEAT_MS);

      const close = () => {
        runEventBus.off(runId, onLive);
        clearInterval(heartbeat);
        request.signal.removeEventListener('abort', close);
        try {
          controller.close();
        } catch {
          // already closed by the other path
        }
      };

      const send = (event: StoredRunEvent) => {
        if (event.seq <= lastSent) return;
        controller.enqueue(encoder.encode(sseChunk(event)));
        lastSent = event.seq;
        if (TERMINAL_TYPES.has(event.type)) {
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          close();
        }
      };

      const onLive = (event: StoredRunEvent) => {
        if (replaying) buffered.push(event);
        else send(event);
      };

      request.signal.addEventListener('abort', close);
      runEventBus.on(runId, onLive);

      const persisted = await listRunEventsAfter(runId, lastEventId);
      for (const row of persisted) {
        send({ seq: row.seq, type: row.payload.type, payload: row.payload });
      }
      replaying = false;
      buffered.forEach(send);

      // A finished run whose terminal event predates Last-Event-ID still ends the stream.
      if (run.finishedAt && persisted.length === 0) {
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

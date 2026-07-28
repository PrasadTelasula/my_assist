import { EventEmitter } from 'node:events';

import { and, asc, eq, gt } from 'drizzle-orm';

import type { AgentEvent } from '@/core/events';
import { db } from '@/server/db/client';
import { type RunEvent, runEvents } from '@/server/db/schema';

// Cached on globalThis so dev HMR keeps one bus (SSE subscribers survive reloads).
const g = globalThis as unknown as { __runEventBus?: EventEmitter };
export const runEventBus = (g.__runEventBus ??= new EventEmitter().setMaxListeners(100));

export interface StoredRunEvent {
  seq: number;
  type: AgentEvent['type'];
  payload: AgentEvent;
}

/** DB first, then fan-out: the row is the source of truth, the bus is live delivery. */
export async function appendRunEvent(runId: string, seq: number, event: AgentEvent): Promise<void> {
  await db.insert(runEvents).values({ runId, seq, type: event.type, payload: event });
  const stored: StoredRunEvent = { seq, type: event.type, payload: event };
  runEventBus.emit(runId, stored);
}

export async function listRunEventsAfter(runId: string, afterSeq: number): Promise<RunEvent[]> {
  return db
    .select()
    .from(runEvents)
    .where(and(eq(runEvents.runId, runId), gt(runEvents.seq, afterSeq)))
    .orderBy(asc(runEvents.seq));
}

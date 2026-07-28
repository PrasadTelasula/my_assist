import { asc, desc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { agents, messages, type Thread, threads } from '@/server/db/schema';
import { runManager, type StartedRun } from '@/server/runs/run-manager';

export async function createThread(input: { agentId: string; title: string }): Promise<Thread> {
  const [thread] = await db.insert(threads).values(input).returning();
  return thread!;
}

export async function listThreads() {
  return db
    .select({
      id: threads.id,
      title: threads.title,
      createdAt: threads.createdAt,
      agentId: agents.id,
      agentName: agents.name,
    })
    .from(threads)
    .innerJoin(agents, eq(threads.agentId, agents.id))
    .orderBy(desc(threads.createdAt));
}

export async function getThreadWithMessages(threadId: string) {
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!thread) return null;
  const history = await db.query.messages.findMany({
    where: eq(messages.threadId, threadId),
    orderBy: asc(messages.createdAt),
  });
  return { ...thread, messages: history };
}

/** Persists the user turn and starts the agent run over the full thread history. */
export async function postUserMessage(input: {
  threadId: string;
  text: string;
}): Promise<StartedRun> {
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, input.threadId) });
  if (!thread) throw new Error(`Thread not found: ${input.threadId}`);
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, thread.agentId) });
  if (!agent) throw new Error(`Agent not found: ${thread.agentId}`);

  const history = await db.query.messages.findMany({
    where: eq(messages.threadId, input.threadId),
    orderBy: asc(messages.createdAt),
  });

  await db.insert(messages).values({ threadId: input.threadId, role: 'user', content: input.text });

  return runManager.startRun({
    trigger: 'chat',
    agent,
    threadId: input.threadId,
    inputText: input.text,
    history: history.map((m) => ({ role: m.role, content: m.content })),
  });
}

import { sql } from 'drizzle-orm';

import { db } from '@/server/db/client';

/** Wipes all domain tables (keeps users) so each test starts from a known state. */
export async function resetDomainTables(): Promise<void> {
  await db.execute(
    sql`TRUNCATE task_activity, run_events, messages, runs, tasks, sprints, agent_tools, tool_versions, tools, threads, agents RESTART IDENTITY CASCADE`,
  );
}

import './load-env';

import { eq } from 'drizzle-orm';

import { db } from '../src/server/db/client';
import { agents, agentTools, tools, users } from '../src/server/db/schema';
import { LOCAL_USER_EMAIL } from '../src/server/db/seed-user';
import { createTool } from '../src/server/tools';

const GET_TIME_TOOL = `export const schema = { type: 'object', properties: {} };

export default async function run() {
  return new Date().toISOString();
}
`;

export async function seed(): Promise<void> {
  await db
    .insert(users)
    .values({ email: LOCAL_USER_EMAIL, name: 'Local User' })
    .onConflictDoNothing();

  await db
    .insert(agents)
    .values([
      {
        name: 'Scout',
        description: 'General-purpose starter agent',
        systemPrompt:
          'You are Scout, a pragmatic assistant. Use your tools when they help; answer directly when they do not.',
        modelProvider: 'anthropic',
        modelId: 'claude-sonnet-5',
      },
      {
        name: 'Planner',
        description: 'Decomposes sprint goals into small, deliverable stories',
        systemPrompt:
          'You are Planner, a pragmatic scrum planner. You break goals into the smallest stories that each deliver visible value, write descriptions a stranger could pick up, and estimate conservatively. You never invent scope beyond the goal.',
        modelProvider: 'anthropic',
        modelId: 'claude-sonnet-5',
      },
    ])
    .onConflictDoNothing();

  // Key-free demo agent for e2e and first-run exploration.
  if (process.env.MY_ASSIST_PROVIDER === 'fake') {
    await db
      .insert(agents)
      .values({
        name: 'Demo',
        description: 'Key-free scripted agent (fake provider)',
        systemPrompt: 'You are the demo agent.',
        modelProvider: 'fake',
        modelId: 'demo',
      })
      .onConflictDoNothing();
  }

  // get_time is an ordinary sandboxed tool, not a hidden built-in: agents only
  // ever see tools someone attached to them.
  const existing = await db.query.tools.findFirst({ where: eq(tools.name, 'get_time') });
  const getTime =
    existing ??
    (await createTool({
      name: 'get_time',
      description: 'Get the current date and time (ISO 8601, UTC).',
      tsCode: GET_TIME_TOOL,
      permissions: { net: false },
    }));

  // Attach it to the agents that demonstrate tool calling.
  const demoUsers = await db.query.agents.findMany();
  for (const agent of demoUsers.filter((a) => a.name === 'Scout' || a.name === 'Demo')) {
    await db
      .insert(agentTools)
      .values({ agentId: agent.id, toolId: getTime.id })
      .onConflictDoNothing();
  }

  console.log('seeded');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

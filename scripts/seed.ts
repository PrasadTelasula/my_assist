import { db } from '../src/server/db/client';
import { agents, users } from '../src/server/db/schema';
import { LOCAL_USER_EMAIL } from '../src/server/db/seed-user';

async function main(): Promise<void> {
  await db
    .insert(users)
    .values({ email: LOCAL_USER_EMAIL, name: 'Local User' })
    .onConflictDoNothing();

  await db
    .insert(agents)
    .values({
      name: 'Scout',
      description: 'General-purpose starter agent',
      systemPrompt:
        'You are Scout, a pragmatic assistant. Use your tools when they help; answer directly when they do not.',
      modelProvider: 'anthropic',
      modelId: 'claude-sonnet-5',
    })
    .onConflictDoNothing();

  console.log('seeded');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import { asc } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { agents } from '@/server/db/schema';

export async function GET() {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      modelProvider: agents.modelProvider,
      modelId: agents.modelId,
    })
    .from(agents)
    .orderBy(asc(agents.name));
  return Response.json(rows);
}

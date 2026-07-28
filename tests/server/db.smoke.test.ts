import { describe, expect, it } from 'vitest';

import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { getCurrentUser } from '@/server/db/seed-user';

describe('database', () => {
  it('has migrations applied and the local user seeded', async () => {
    const rows = await db.select().from(users);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const user = await getCurrentUser();
    expect(user.email).toBe('local@my-assist.dev');
    expect(user.name).toBe('Local User');
  });
});

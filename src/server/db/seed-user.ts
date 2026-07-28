import { db } from './client';
import { type User } from './schema';

export const LOCAL_USER_EMAIL = 'local@my-assist.dev';

/**
 * Auth seam: single-user local mode returns the seeded user. Replacing this
 * with a real session lookup is the entire auth migration surface.
 */
export async function getCurrentUser(): Promise<User> {
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, LOCAL_USER_EMAIL),
  });
  if (!user) throw new Error('Local user missing — run `npm run seed`');
  return user;
}

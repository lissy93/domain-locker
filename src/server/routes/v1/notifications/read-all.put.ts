import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ read: z.boolean().default(true) });

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => ({
  updated: await db.notifications.markAllRead(body.read),
}));

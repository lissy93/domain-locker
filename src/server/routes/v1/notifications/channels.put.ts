import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ channels: z.record(z.string(), z.unknown()) });

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => {
  await db.notifications.setChannels(body.channels);
  return { updated: true };
});

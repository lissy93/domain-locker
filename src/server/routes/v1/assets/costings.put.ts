import { defineApiRoute } from '../../../lib/handler';
import { costingsSchema } from '../../../lib/schemas';

export default defineApiRoute(
  { write: true, body: costingsSchema },
  async ({ db, body }) => {
    await db.assets.setCostings(body.updates);
    return { updated: body.updates.length };
  },
);

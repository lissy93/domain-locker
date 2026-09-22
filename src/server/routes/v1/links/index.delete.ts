import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ link_ids: z.array(z.string().uuid()).min(1) });

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => ({
  deleted: await db.links.remove(body.link_ids),
}));

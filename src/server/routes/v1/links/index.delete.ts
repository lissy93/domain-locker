import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ link_name: z.string(), link_url: z.string() });

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => ({
  deleted: await db.links.remove(body),
}));

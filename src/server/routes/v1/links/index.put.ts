import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { linkSchema } from '../../../lib/schemas';

const schema = linkSchema().extend({
  link_ids: z.array(z.string().uuid()).default([]),
  domains: z.array(z.string().trim().min(1)),
});

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => {
  await db.links.update(body.link_ids, body);
  return { updated: true };
});

import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { linkSchema } from '../../../lib/schemas';

const schema = linkSchema().extend({ domains: z.array(z.string().trim().min(1)) });

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => ({
  added: await db.links.add(body),
}));

import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { linkSchema } from '../../../lib/schemas';

const schema = z.object({
  link: linkSchema(),
  domainIds: z.array(z.string().uuid()).min(1),
});

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => ({
  added: await db.links.addToDomains(body.link, body.domainIds),
}));

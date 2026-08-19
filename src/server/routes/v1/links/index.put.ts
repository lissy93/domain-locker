import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { linkSchema } from '../../../lib/schemas';

const schema = z.object({
  original: z.object({ link_name: z.string(), link_url: z.string() }),
  link: linkSchema(),
  domainIds: z.array(z.string().uuid()),
});

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => {
  await db.links.updateAcrossDomains(body.original, body.link, body.domainIds);
  return { updated: true };
});

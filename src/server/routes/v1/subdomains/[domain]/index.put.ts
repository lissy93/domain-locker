import { z } from 'zod';
import { defineApiRoute } from '../../../../lib/handler';
import { notFound } from '../../../../lib/errors';

const schema = z.object({
  subdomains: z.array(
    z.object({ name: z.string().trim().min(1), sd_info: z.unknown().optional() }),
  ),
});

export default defineApiRoute(
  { write: true, body: schema },
  async ({ db, body, param }) => {
    if (!(await db.subdomains.replaceForDomain(param('domain'), body.subdomains))) {
      throw notFound('Domain');
    }
    return { updated: body.subdomains.length };
  },
);

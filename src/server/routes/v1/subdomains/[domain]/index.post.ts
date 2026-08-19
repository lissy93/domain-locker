import { z } from 'zod';
import { defineApiRoute } from '../../../../lib/handler';
import { notFound } from '../../../../lib/errors';

const schema = z.object({
  name: z.string().trim().min(1),
  sd_info: z.unknown().optional(),
});

export default defineApiRoute(
  { write: true, body: schema },
  async ({ db, body, param }) => {
    if (!(await db.subdomains.add(param('domain'), body))) throw notFound('Domain');
    return { added: true };
  },
);

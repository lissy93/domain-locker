import { z } from 'zod';
import { defineApiRoute } from '../../../../lib/handler';

const schema = z.object({ domainIds: z.array(z.string().uuid()) });

export default defineApiRoute(
  { write: true, body: schema },
  async ({ db, body, uuidParam }) => {
    await db.tags.setDomainsForTag(uuidParam('id'), body.domainIds);
    return { updated: body.domainIds.length };
  },
);

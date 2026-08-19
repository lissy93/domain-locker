import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';
import { saveDomainSchema } from '../../../lib/schemas';

export default defineApiRoute(
  { write: true, body: saveDomainSchema },
  async ({ db, body, param }) => {
    const updated = await db.domains.update(param('id'), body);
    if (!updated) throw notFound('Domain');
    return updated;
  },
);

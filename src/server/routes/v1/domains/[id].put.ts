import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';
import { saveDomainSchema } from '../../../lib/schemas';

export default defineApiRoute(
  { write: true, body: saveDomainSchema },
  async ({ db, body, uuidParam }) => {
    const updated = await db.domains.update(uuidParam('id'), body);
    if (!updated) throw notFound('Domain');
    return updated;
  },
);

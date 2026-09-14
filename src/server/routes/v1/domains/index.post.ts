import { defineApiRoute } from '../../../lib/handler';
import { apiError } from '../../../lib/errors';
import { saveDomainSchema } from '../../../lib/schemas';

export default defineApiRoute(
  { write: true, body: saveDomainSchema },
  async ({ db, body }) => {
    if (await db.domains.exists(body.domain.domain_name)) {
      throw apiError('conflict', 'That domain is already being tracked');
    }
    return db.domains.save(body);
  },
);

import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';

export default defineApiRoute({}, async ({ db, uuidParam }) => {
  const domain = await db.domains.getById(uuidParam('id'));
  if (!domain) throw notFound('Domain');
  return domain;
});

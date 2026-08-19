import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';

export default defineApiRoute({}, async ({ db, param }) => {
  const domain = await db.domains.getById(param('id'));
  if (!domain) throw notFound('Domain');
  return domain;
});

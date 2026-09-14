import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';

export default defineApiRoute({ write: true }, async ({ db, uuidParam }) => {
  if (!(await db.domains.remove(uuidParam('id')))) throw notFound('Domain');
  return { deleted: true };
});

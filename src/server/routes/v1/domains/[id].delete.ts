import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';

export default defineApiRoute({ write: true }, async ({ db, param }) => {
  if (!(await db.domains.remove(param('id')))) throw notFound('Domain');
  return { deleted: true };
});

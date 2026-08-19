import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';

export default defineApiRoute({ write: true }, async ({ db, uuidParam }) => {
  if (!(await db.tags.remove(uuidParam('id')))) throw notFound('Tag');
  return { deleted: true };
});

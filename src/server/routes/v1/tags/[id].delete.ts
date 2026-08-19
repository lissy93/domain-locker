import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';

export default defineApiRoute({ write: true }, async ({ db, param }) => {
  if (!(await db.tags.remove(param('id')))) throw notFound('Tag');
  return { deleted: true };
});

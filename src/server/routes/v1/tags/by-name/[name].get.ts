import { defineApiRoute } from '../../../../lib/handler';
import { notFound } from '../../../../lib/errors';

export default defineApiRoute({}, async ({ db, param }) => {
  const tag = await db.tags.getByName(param('name'));
  if (!tag) throw notFound('Tag');
  return tag;
});

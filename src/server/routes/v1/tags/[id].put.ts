import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';
import { tagSchema } from '../../../lib/schemas';

export default defineApiRoute(
  { write: true, body: tagSchema },
  async ({ db, body, param }) => {
    const updated = await db.tags.update(param('id'), body);
    if (!updated) throw notFound('Tag');
    return updated;
  },
);

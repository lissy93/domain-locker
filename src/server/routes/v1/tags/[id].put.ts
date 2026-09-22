import { defineApiRoute } from '../../../lib/handler';
import { notFound } from '../../../lib/errors';
import { tagSchema } from '../../../lib/schemas';

export default defineApiRoute(
  { write: true, body: tagSchema },
  async ({ db, body, uuidParam }) => {
    const updated = await db.tags.update(uuidParam('id'), body);
    if (!updated) throw notFound('Tag');
    return updated;
  },
);

import { defineApiRoute } from '../../../lib/handler';
import { tagSchema } from '../../../lib/schemas';

export default defineApiRoute({ write: true, body: tagSchema }, ({ db, body }) =>
  db.tags.create(body),
);

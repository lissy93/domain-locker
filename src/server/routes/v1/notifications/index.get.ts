import { defineApiRoute } from '../../../lib/handler';
import { paginationSchema } from '../../../lib/schemas';

export default defineApiRoute({ query: paginationSchema }, ({ db, query }) =>
  db.notifications.list(query.limit, query.offset),
);

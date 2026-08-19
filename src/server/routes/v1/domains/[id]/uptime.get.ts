import { defineApiRoute } from '../../../../lib/handler';
import { uptimeQuerySchema } from '../../../../lib/schemas';

export default defineApiRoute({ query: uptimeQuerySchema }, ({ db, query, uuidParam }) =>
  db.uptime.history(uuidParam('id'), query.timeframe),
);

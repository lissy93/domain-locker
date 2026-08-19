import { defineApiRoute } from '../../../../lib/handler';
import { uptimeQuerySchema } from '../../../../lib/schemas';

export default defineApiRoute({ query: uptimeQuerySchema }, ({ db, query, param }) =>
  db.uptime.history(param('id'), query.timeframe),
);

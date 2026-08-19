import { defineApiRoute } from '../../../../lib/handler';
import { dailyUptimeQuerySchema } from '../../../../lib/schemas';

export default defineApiRoute({ query: dailyUptimeQuerySchema }, ({ db, query, param }) =>
  db.uptime.daily(param('id'), query.days),
);

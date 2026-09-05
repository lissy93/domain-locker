import { defineApiRoute } from '../../../../lib/handler';
import { dailyUptimeQuerySchema } from '../../../../lib/schemas';

export default defineApiRoute(
  { query: dailyUptimeQuerySchema },
  ({ db, query, uuidParam }) => db.uptime.daily(uuidParam('id'), query.days),
);

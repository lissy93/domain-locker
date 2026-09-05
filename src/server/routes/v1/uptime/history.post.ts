import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { uptimeQuerySchema } from '../../../lib/schemas';

const schema = uptimeQuerySchema.extend({
  domainIds: z.array(z.string().uuid()).max(500),
});

// Batched so the monitor page makes one request rather than one per domain
export default defineApiRoute({ body: schema }, ({ db, body }) =>
  db.uptime.historyFor(body.domainIds, body.timeframe),
);

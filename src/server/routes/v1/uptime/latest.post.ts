import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ domainIds: z.array(z.string().uuid()).max(500) });

// Batched so the monitor page does not fetch one domain at a time
export default defineApiRoute({ body: schema }, ({ db, body }) =>
  db.uptime.latestFor(body.domainIds),
);

import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ ipv6: z.enum(['true', 'false']).default('false') });

export default defineApiRoute({ query: schema }, ({ db, query }) =>
  db.assets.ipAddresses(query.ipv6 === 'true'),
);

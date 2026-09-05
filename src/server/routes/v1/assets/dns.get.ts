import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ type: z.enum(['MX', 'TXT', 'NS']) });

export default defineApiRoute({ query: schema }, ({ db, query }) =>
  db.assets.dnsRecords(query.type),
);

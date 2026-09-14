import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ statuses: z.array(z.string().trim().min(1)) });

export default defineApiRoute({ body: schema }, ({ db, body }) =>
  db.domains.byEppCodes(body.statuses),
);

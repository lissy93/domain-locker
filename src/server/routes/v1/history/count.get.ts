import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({ domain: z.string().trim().optional() });

export default defineApiRoute({ query: schema }, async ({ db, query }) => ({
  total: await db.history.totalCount(query.domain),
}));

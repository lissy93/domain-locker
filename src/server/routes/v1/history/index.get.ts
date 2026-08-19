import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { paginationSchema } from '../../../lib/schemas';

const schema = paginationSchema.extend({ domain: z.string().trim().optional() });

export default defineApiRoute({ query: schema }, ({ db, query }) =>
  db.history.list({
    limit: query.limit,
    offset: query.offset,
    domainName: query.domain,
  }),
);

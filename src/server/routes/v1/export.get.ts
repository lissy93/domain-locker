import { z } from 'zod';
import { defineApiRoute } from '../../lib/handler';

const schema = z.object({ domains: z.string().trim().optional() });

export default defineApiRoute({ query: schema }, ({ db, query }) =>
  db.export.rows(
    query.domains
      ? query.domains
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean)
      : undefined,
  ),
);

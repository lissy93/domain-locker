import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';

const schema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  domain: z.string().trim().optional(),
});

export default defineApiRoute({ query: schema }, ({ db, query }) =>
  db.history.changesByDay(query.days, query.domain),
);

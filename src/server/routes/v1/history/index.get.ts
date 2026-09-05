import { defineApiRoute } from '../../../lib/handler';
import { historyFiltersSchema, paginationSchema } from '../../../lib/schemas';

const schema = paginationSchema.merge(historyFiltersSchema);

export default defineApiRoute({ query: schema }, ({ db, query }) =>
  db.history.list({
    limit: query.limit,
    offset: query.offset,
    domainName: query.domain,
    category: query.category,
    changeType: query.changeType,
    search: query.search,
  }),
);

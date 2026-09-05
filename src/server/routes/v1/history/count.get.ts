import { defineApiRoute } from '../../../lib/handler';
import { historyFiltersSchema } from '../../../lib/schemas';

export default defineApiRoute({ query: historyFiltersSchema }, async ({ db, query }) => ({
  total: await db.history.totalCount({
    domainName: query.domain,
    category: query.category,
    changeType: query.changeType,
    search: query.search,
  }),
}));

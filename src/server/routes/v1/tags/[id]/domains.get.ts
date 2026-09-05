import { defineApiRoute } from '../../../../lib/handler';

export default defineApiRoute({}, ({ db, uuidParam }) =>
  db.tags.domainsForTag(uuidParam('id')),
);

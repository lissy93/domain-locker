import { defineApiRoute } from '../../../../lib/handler';

export default defineApiRoute({}, ({ db, param }) =>
  db.subdomains.byDomain(param('domain')),
);

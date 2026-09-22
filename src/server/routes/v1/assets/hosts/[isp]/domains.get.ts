import { defineApiRoute } from '../../../../../lib/handler';

export default defineApiRoute({}, ({ db, param }) =>
  db.domains.listByHostIsp(param('isp')),
);

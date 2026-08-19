import { defineApiRoute } from '../../../../lib/handler';
import { notFound } from '../../../../lib/errors';

export default defineApiRoute({ write: true }, async ({ db, param }) => {
  if (!(await db.subdomains.remove(param('domain'), param('name')))) {
    throw notFound('Subdomain');
  }
  return { deleted: true };
});

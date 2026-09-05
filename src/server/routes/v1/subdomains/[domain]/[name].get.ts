import { defineApiRoute } from '../../../../lib/handler';
import { notFound } from '../../../../lib/errors';

export default defineApiRoute({}, async ({ db, param }) => {
  const info = await db.subdomains.info(param('domain'), param('name'));
  if (!info) throw notFound('Subdomain');
  return info;
});

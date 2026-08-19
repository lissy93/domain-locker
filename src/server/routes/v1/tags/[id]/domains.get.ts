import { defineApiRoute } from '../../../../lib/handler';

export default defineApiRoute({}, ({ db, param }) => db.tags.domainsForTag(param('id')));

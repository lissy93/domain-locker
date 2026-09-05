import { defineApiRoute } from '../../../lib/handler';

export default defineApiRoute({}, ({ db }) => db.links.list());

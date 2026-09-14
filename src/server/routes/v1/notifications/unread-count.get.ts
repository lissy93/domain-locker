import { defineApiRoute } from '../../../lib/handler';

export default defineApiRoute({}, async ({ db }) => ({
  total: await db.notifications.unreadCount(),
}));

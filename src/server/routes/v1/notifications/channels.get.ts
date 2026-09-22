import { defineApiRoute } from '../../../lib/handler';

export default defineApiRoute({}, async ({ db }) => ({
  channels: await db.notifications.channels(),
}));

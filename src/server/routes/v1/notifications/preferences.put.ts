import { defineApiRoute } from '../../../lib/handler';
import { notificationPreferencesSchema } from '../../../lib/schemas';

export default defineApiRoute(
  { write: true, body: notificationPreferencesSchema },
  async ({ db, body }) => {
    await db.notifications.setPreferences(body.preferences);
    return { updated: body.preferences.length };
  },
);

import { z } from 'zod';
import { defineApiRoute } from '../../../../lib/handler';
import { notFound } from '../../../../lib/errors';

const schema = z.object({ read: z.boolean() });

export default defineApiRoute(
  { write: true, body: schema },
  async ({ db, body, param }) => {
    if (!(await db.notifications.markRead(param('id'), body.read))) {
      throw notFound('Notification');
    }
    return { updated: true };
  },
);

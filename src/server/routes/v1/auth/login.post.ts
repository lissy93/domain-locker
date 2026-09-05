import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { apiError } from '../../../lib/errors';
import { checkPassword, isAuthEnabled, startSession } from '../../../lib/auth';

const schema = z.object({ password: z.string() });

export default defineApiRoute(
  { public: true, skipMigration: true, body: schema },
  ({ event, body }) => {
    if (!isAuthEnabled()) return { authenticated: true };
    if (!checkPassword(body.password)) {
      throw apiError('unauthorized', 'Incorrect password');
    }
    startSession(event);
    return { authenticated: true };
  },
);

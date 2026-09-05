import { defineApiRoute } from '../../../lib/handler';
import { endSession } from '../../../lib/auth';

export default defineApiRoute({ public: true, skipMigration: true }, ({ event }) => {
  endSession(event);
  return { authenticated: false };
});

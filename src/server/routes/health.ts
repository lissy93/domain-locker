import { defineEventHandler, setResponseStatus } from 'h3';
import { databaseStatus, ensureMigrated } from '../db/ready';

/** Healthcheck endpoint. Used by Docker */
export default defineEventHandler((event) => {
  const database = databaseStatus();
  if (database !== 'failed') {
    return { status: 'ok', database, message: "Houston, We're still alive 💗." };
  }

  // Pick the setup back up, so an unattended install recovers on its own
  void ensureMigrated().catch(() => undefined);
  setResponseStatus(event, 503);
  return { status: 'error', database, message: 'Database setup failed' };
});

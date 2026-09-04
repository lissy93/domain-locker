import { ensureMigrated } from '../db/ready';
import Logger from '../utils/logger';

const log = new Logger('startup');

/* Sets the database up as the server boots. So that the job scheduler can start */
export default function initialiseDatabase() {
  if (process.env['DL_ENV_TYPE'] !== 'selfHosted') return;
  if (process.env['DL_BUILDING'] === 'true') return;

  void ensureMigrated().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Database setup failed, retrying on the next request: ${message}`);
  });
}

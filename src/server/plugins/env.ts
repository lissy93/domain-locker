import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import Logger from '../utils/logger';

const log = new Logger('env');

/**
 * Only the dev server reads a .env file, so a build started with `node
 * dist/analog/server/index.mjs` would otherwise see none of its settings and
 * silently fall back to defaults. Real environment variables still win, which
 * leaves Docker and hosted platforms untouched.
 */
export default function loadEnvFile() {
  const path = resolve(process.env['DL_ENV_FILE'] || '.env');
  if (!existsSync(path)) return;

  const { error, parsed } = config({ path, override: false });
  if (error) {
    log.warn(`Could not read ${path}, continuing without it: ${error.message}`);
    return;
  }
  log.info(`Read ${Object.keys(parsed ?? {}).length} settings from ${path}`);
}

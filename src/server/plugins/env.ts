import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import Logger from '../utils/logger';

const log = new Logger('env');

/** Nitro only reads .env in dev, so a built server would otherwise ignore it */
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

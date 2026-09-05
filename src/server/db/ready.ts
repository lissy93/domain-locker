import { currentBackend, getDb, selectedBackend, sqlitePath } from './client';
import { migrateToLatest } from './migrations';
import Logger from '../utils/logger';

const log = new Logger('database');

let migration: Promise<void> | null = null;

/** How the one-time setup went. So the healthcheck can report a broken database */
export type DatabaseStatus = 'pending' | 'ready' | 'failed';

let status: DatabaseStatus = 'pending';

export function databaseStatus(): DatabaseStatus {
  return status;
}

/**
 * Brings the database up to date on first use
 */
export function ensureMigrated(): Promise<void> {
  migration ??= runMigrations();
  return migration;
}

export function resetMigrationState(): void {
  migration = null;
  status = 'pending';
}

const PG_VARS = ['DL_PG_HOST', 'DL_PG_USER', 'DL_PG_PASSWORD', 'DL_PG_NAME'];

/** Half-configured Postgres would otherwise drop to SQLite without a word */
function warnAboutPartialPostgres(): void {
  const missing = PG_VARS.filter((name) => !process.env[name]);
  if (missing.length === PG_VARS.length) return;
  log.warn(
    `Postgres is only partly configured, so SQLite is being used instead. ` +
      `Missing: ${missing.join(', ')}`,
  );
}

async function runMigrations(): Promise<void> {
  if (process.env['DL_ENV_TYPE'] === 'managed') {
    throw new Error('The self-hosted data core is not used on managed instances');
  }
  if (process.env['DL_SKIP_MIGRATIONS'] === 'true') {
    log.warn('DL_SKIP_MIGRATIONS is set, leaving the database untouched');
    status = 'ready';
    return;
  }

  const backend = selectedBackend();
  if (backend === 'postgres') {
    log.info(
      `Using Postgres at ${process.env['DL_PG_HOST']}/${process.env['DL_PG_NAME']}`,
    );
  } else {
    warnAboutPartialPostgres();
    log.info(`Using SQLite at ${sqlitePath()}`);
  }

  try {
    const { applied } = await migrateToLatest(getDb(), currentBackend());
    if (applied.length) log.success(`Applied migrations: ${applied.join(', ')}`);
    else log.info('Database already up to date');
    status = 'ready';
  } catch (err) {
    // Retry on the next request rather than leaving the app permanently broken
    migration = null;
    status = 'failed';
    throw err;
  }
}

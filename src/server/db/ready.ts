import { currentBackend, getDb, selectedBackend, sqlitePath } from './client';
import { migrateToLatest } from './migrations';
import Logger from '../utils/logger';

const log = new Logger('database');

let migration: Promise<void> | null = null;

/**
 * Brings the database up to date on first use. Memoised, so concurrent
 * requests share one run and later requests pay nothing. Existing installs
 * are baselined rather than re-run, so upgrading never replays DDL over
 * live tables.
 */
export function ensureMigrated(): Promise<void> {
  migration ??= runMigrations();
  return migration;
}

export function resetMigrationState(): void {
  migration = null;
}

async function runMigrations(): Promise<void> {
  if (process.env['DL_SKIP_MIGRATIONS'] === 'true') {
    log.warn('DL_SKIP_MIGRATIONS is set, leaving the database untouched');
    return;
  }

  const backend = selectedBackend();
  log.info(
    backend === 'postgres'
      ? `Using Postgres at ${process.env['DL_PG_HOST']}/${process.env['DL_PG_NAME']}`
      : `Using SQLite at ${sqlitePath()}`,
  );

  try {
    const { applied, baselined } = await migrateToLatest(getDb(), currentBackend());
    if (baselined.length) log.info(`Baselined existing database at ${baselined.at(-1)}`);
    if (applied.length) log.success(`Applied migrations: ${applied.join(', ')}`);
    if (!applied.length && !baselined.length) log.info('Database already up to date');
  } catch (err) {
    // Retry on the next request rather than leaving the app permanently broken
    migration = null;
    throw err;
  }
}

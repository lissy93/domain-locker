import { readFileSync } from 'node:fs';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../schema';
import type { Backend } from '../client';
import { SQLITE_INITIAL_SCHEMA } from './sqlite-initial';
import { POSTGRES_JOB_RUNS, SQLITE_JOB_RUNS } from './002-job-runs';
import Logger from '../../utils/logger';

const log = new Logger('migrations');

export interface Migration {
  version: string;
  /** SQL per dialect. Omit a dialect when the change does not apply to it */
  statements: Partial<Record<Backend, () => string[]>>;
}

/**
 * SQLite's driver prepares one statement at a time, so scripts are split.
 * Safe here because our DDL never contains a semicolon inside a literal.
 */
export function splitStatements(script: string): string[] {
  return script
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/**
 * Versioned, additive, forward-only migrations. Nothing here may drop or
 * rename an existing column while a deprecation window is open, so an install
 * can always be rolled back to the previous minor release.
 */
/** The schema every pre-runner install already has */
export const BASELINE_VERSION = '001_initial_schema';

export const MIGRATIONS: Migration[] = [
  {
    version: '001_initial_schema',
    statements: {
      // Postgres accepts the whole script in one go, dollar-quoted bodies included
      postgres: () => [readPostgresSchema()],
      sqlite: () => splitStatements(SQLITE_INITIAL_SCHEMA),
    },
  },
  {
    version: '002_job_runs',
    statements: {
      postgres: () => POSTGRES_JOB_RUNS,
      sqlite: () => SQLITE_JOB_RUNS,
    },
  },
];

/** Mirrors start.sh, which copies db/schema.sql to the image root */
function readPostgresSchema(): string {
  for (const path of ['./schema.sql', './db/schema.sql']) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      continue;
    }
  }
  throw new Error('Could not find schema.sql (looked in ./schema.sql, ./db/schema.sql)');
}

export async function migrateToLatest(
  db: Kysely<Database>,
  backend: Backend,
): Promise<{ applied: string[]; baselined: string[] }> {
  await ensureMigrationsTable(db, backend);

  const applied = new Set(
    (await db.selectFrom('schema_migrations').select('version').execute()).map(
      (row) => row.version,
    ),
  );

  // An install that predates the runner already has the initial schema, so
  // record it as done rather than replaying DDL over live tables
  const baselined: string[] = [];
  if (!applied.size && (await hasLegacyTables(db))) {
    // Only the initial schema predates the runner; later migrations still apply
    await recordVersion(db, BASELINE_VERSION);
    applied.add(BASELINE_VERSION);
    baselined.push(BASELINE_VERSION);
    log.info(`Existing database detected, baselined at ${BASELINE_VERSION}`);
  }

  const newlyApplied: string[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    const statements = migration.statements[backend];
    if (!statements) {
      await recordVersion(db, migration.version);
      continue;
    }

    log.info(`Applying ${migration.version}`);
    await db.transaction().execute(async (trx) => {
      for (const statement of statements()) {
        await sql.raw(statement).execute(trx);
      }
      await recordVersion(trx, migration.version);
    });
    newlyApplied.push(migration.version);
  }

  if (newlyApplied.length) {
    log.success(`Applied ${newlyApplied.length} migration(s)`);
  }
  return { applied: newlyApplied, baselined };
}

async function ensureMigrationsTable(
  db: Kysely<Database>,
  backend: Backend,
): Promise<void> {
  const now = backend === 'postgres' ? 'CURRENT_TIMESTAMP' : `(datetime('now'))`;
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version TEXT PRIMARY KEY,
         applied_at TEXT NOT NULL DEFAULT ${now}
       )`,
    )
    .execute(db);
}

/** True when the app's tables exist but the runner has never recorded a version */
async function hasLegacyTables(db: Kysely<Database>): Promise<boolean> {
  try {
    await db.selectFrom('domains').select('id').limit(1).execute();
    return true;
  } catch {
    return false;
  }
}

function recordVersion(db: Kysely<Database>, version: string) {
  return db
    .insertInto('schema_migrations')
    .values({ version })
    .onConflict((conflict) => conflict.column('version').doNothing())
    .execute();
}

import { readFileSync } from 'node:fs';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../schema';
import type { Backend } from '../client';
import { SQLITE_INITIAL_SCHEMA } from './sqlite-initial';
import { POSTGRES_JOB_RUNS, SQLITE_JOB_RUNS } from './002-job-runs';
import { POSTGRES_DOMAIN_DATES } from './003-domain-dates';
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
export const MIGRATIONS: Migration[] = [
  {
    version: '002_job_runs',
    statements: {
      postgres: () => POSTGRES_JOB_RUNS,
      sqlite: () => SQLITE_JOB_RUNS,
    },
  },
  {
    // SQLite already stores these as text, so only Postgres needs narrowing
    version: '003_domain_dates',
    statements: {
      postgres: () => POSTGRES_DOMAIN_DATES,
    },
  },
];

/** Mirrors start.sh, which copies db/schema.sql to the image root */
function readPostgresSchema(): string | null {
  for (const path of ['./schema.sql', './db/schema.sql']) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      continue;
    }
  }
  return null;
}

/** Base schema, safe to re-apply on every boot */
async function ensureBaseSchema(db: Kysely<Database>, backend: Backend): Promise<void> {
  if (backend === 'sqlite') {
    for (const statement of splitStatements(SQLITE_INITIAL_SCHEMA)) {
      await sql.raw(statement).execute(db);
    }
    return;
  }

  const schema = readPostgresSchema();
  if (!schema) {
    // Only a first run needs the file
    if (await hasTables(db)) {
      log.warn('schema.sql not found, leaving the existing schema as it is');
      return;
    }
    throw new Error(
      'Could not find schema.sql (looked in ./schema.sql, ./db/schema.sql)',
    );
  }

  try {
    await sql.raw(schema).execute(db);
  } catch (err) {
    // A restricted role cannot re-apply it, but an existing database still works
    if (!(await hasTables(db))) throw err;
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      `Could not re-apply schema.sql, continuing with the existing one: ${message}`,
    );
  }
}

export async function migrateToLatest(
  db: Kysely<Database>,
  backend: Backend,
): Promise<{ applied: string[] }> {
  await ensureBaseSchema(db, backend);
  await ensureMigrationsTable(db, backend);

  const applied = new Set(
    (await db.selectFrom('schema_migrations').select('version').execute()).map(
      (row) => row.version,
    ),
  );

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

  return { applied: newlyApplied };
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

async function hasTables(db: Kysely<Database>): Promise<boolean> {
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

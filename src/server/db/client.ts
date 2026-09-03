import { Kysely, PostgresDialect, SqliteDialect, type Dialect } from 'kysely';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import type { Database } from './schema';
import { SqliteTypePlugin } from './sqlite-plugin';

export type Backend = 'postgres' | 'sqlite';

// Only the container has a writable /data, where the image points DL_SQLITE_PATH
const DEFAULT_SQLITE_PATH = './data/domain-locker.db';

/** Postgres wins when configured, so existing installs keep their database */
export function selectedBackend(): Backend {
  const { DL_PG_HOST, DL_PG_USER, DL_PG_PASSWORD, DL_PG_NAME } = process.env;
  return DL_PG_HOST && DL_PG_USER && DL_PG_PASSWORD && DL_PG_NAME ? 'postgres' : 'sqlite';
}

/** Absolute, so logs and errors name the file that was actually opened */
export function sqlitePath(): string {
  const configured = process.env['DL_SQLITE_PATH'] || DEFAULT_SQLITE_PATH;
  return configured === ':memory:' ? configured : resolve(configured);
}

let instance: Kysely<Database> | null = null;
let instanceBackend: Backend | null = null;

/** Shared connection, created on first use */
export function getDb(): Kysely<Database> {
  if (!instance) {
    instanceBackend = selectedBackend();
    instance = createDb(instanceBackend);
  }
  return instance;
}

export function currentBackend(): Backend {
  return instanceBackend ?? selectedBackend();
}

export function createDb(backend: Backend = selectedBackend()): Kysely<Database> {
  return backend === 'postgres'
    ? new Kysely<Database>({ dialect: postgresDialect() })
    : new Kysely<Database>({
        dialect: sqliteDialect(),
        plugins: [new SqliteTypePlugin()],
      });
}

/** In-memory database for tests, so suites never touch a real file */
export function createSqliteMemoryDb(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: sqliteDialect(':memory:'),
    plugins: [new SqliteTypePlugin()],
  });
}

export async function closeDb(): Promise<void> {
  const current = instance;
  instance = null;
  instanceBackend = null;
  await current?.destroy();
}

function postgresDialect(): Dialect {
  return new PostgresDialect({
    pool: new pg.Pool({
      host: process.env['DL_PG_HOST'],
      port: Number(process.env['DL_PG_PORT'] || 5432),
      user: process.env['DL_PG_USER'],
      password: process.env['DL_PG_PASSWORD'],
      database: process.env['DL_PG_NAME'],
      max: Number(process.env['DL_PG_POOL_SIZE'] || 10),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: Number(process.env['DL_PG_STATEMENT_TIMEOUT'] || 15_000),
      types: { getTypeParser: getPostgresTypeParser } as never,
    }),
  });
}

function sqliteDialect(path = sqlitePath()): Dialect {
  return new SqliteDialect({
    database: async () => {
      const { default: SqliteDatabase } = await import('better-sqlite3');
      const database = openSqliteFile(SqliteDatabase, path);
      database.pragma('journal_mode = WAL');
      database.pragma('foreign_keys = ON');
      database.pragma('busy_timeout = 5000');
      return database;
    },
  });
}

const FILE_ERROR_CODES = ['EACCES', 'EPERM', 'EROFS', 'ENOENT', 'ENOTDIR', 'ENOSPC'];

/** Sending someone to check permissions over a stale binary wastes their time */
export function sqliteOpenAdvice(error: NodeJS.ErrnoException): string {
  const code = error.code ?? '';
  if (FILE_ERROR_CODES.includes(code) || code.startsWith('SQLITE_')) {
    return 'Set DL_SQLITE_PATH to a writable path, or configure Postgres with DL_PG_*';
  }
  return (
    'The better-sqlite3 binary does not match the Node version running the app. ' +
    'Run `npm rebuild better-sqlite3` under that same version'
  );
}

/** A bare EACCES, or a bare ABI mismatch, says nothing about how to fix it */
function openSqliteFile<T>(open: new (path: string) => T, path: string): T {
  try {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    return new open(path);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(
      `Cannot open the SQLite database at ${path}: ${error.message}. ` +
        sqliteOpenAdvice(error),
    );
  }
}

const PG_TYPE_DATE = 1082;
const PG_TYPE_TIMESTAMP = 1114;
const PG_TYPE_TIMESTAMPTZ = 1184;
const PG_TYPE_NUMERIC = 1700;
const PG_TYPE_INT8 = 20;

/**
 * Scoped to this pool, and aligned with SQLite so both dialects agree:
 * ISO timestamps, real numbers, plain dates.
 */
function getPostgresTypeParser(oid: number, format?: string) {
  if (format === undefined || format === 'text') {
    switch (oid) {
      case PG_TYPE_DATE:
        return (value: string) => value;
      case PG_TYPE_TIMESTAMP:
      case PG_TYPE_TIMESTAMPTZ:
        return toIsoString;
      case PG_TYPE_NUMERIC:
      case PG_TYPE_INT8:
        return (value: string) => Number(value);
    }
  }
  return pg.types.getTypeParser(oid, format as never);
}

function toIsoString(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

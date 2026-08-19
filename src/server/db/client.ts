import { Kysely, PostgresDialect, SqliteDialect, type Dialect } from 'kysely';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import type { Database } from './schema';
import { SqliteTypePlugin } from './sqlite-plugin';

export type Backend = 'postgres' | 'sqlite';

const DEFAULT_SQLITE_PATH = '/data/domain-locker.db';

/** Postgres wins when configured, so existing installs keep their database */
export function selectedBackend(): Backend {
  const { DL_PG_HOST, DL_PG_USER, DL_PG_PASSWORD, DL_PG_NAME } = process.env;
  return DL_PG_HOST && DL_PG_USER && DL_PG_PASSWORD && DL_PG_NAME ? 'postgres' : 'sqlite';
}

export function sqlitePath(): string {
  return process.env['DL_SQLITE_PATH'] || DEFAULT_SQLITE_PATH;
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
      if (path !== ':memory:') {
        mkdirSync(dirname(path), { recursive: true });
      }
      const database = new SqliteDatabase(path);
      database.pragma('journal_mode = WAL');
      database.pragma('foreign_keys = ON');
      database.pragma('busy_timeout = 5000');
      return database;
    },
  });
}

const PG_TYPE_DATE = 1082;
const PG_TYPE_TIMESTAMP = 1114;
const PG_TYPE_TIMESTAMPTZ = 1184;
const PG_TYPE_NUMERIC = 1700;
const PG_TYPE_INT8 = 20;

/**
 * Scoped to this pool so the legacy pg-executer path keeps its own behaviour.
 * Aligns Postgres output with SQLite: ISO timestamps, real numbers, plain dates.
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

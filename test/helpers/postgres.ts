import { readFileSync } from 'node:fs';
import pkg from 'pg';

const { Client, Pool, types } = pkg;

// Match the app: DATE columns stay YYYY-MM-DD strings
types.setTypeParser(1082, (val) => val);

export interface TestPgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** Connection details for the throwaway test cluster, overridable via TEST_PG_* */
export function testPgConfig(
  database = process.env['TEST_PG_NAME'] || 'dl_test',
): TestPgConfig {
  return {
    host: process.env['TEST_PG_HOST'] || '127.0.0.1',
    port: Number(process.env['TEST_PG_PORT'] || 55432),
    user: process.env['TEST_PG_USER'] || 'postgres',
    password: process.env['TEST_PG_PASSWORD'] || 'postgres',
    database,
  };
}

/** True when a Postgres test cluster is reachable, so suites can skip rather than fail */
export async function isPostgresAvailable(): Promise<boolean> {
  const client = new Client({
    ...testPgConfig('postgres'),
    connectionTimeoutMillis: 2000,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/** Drop and recreate the test database, then apply db/schema.sql */
export async function resetTestDatabase(database?: string): Promise<TestPgConfig> {
  const config = testPgConfig(database);
  const admin = new Client(testPgConfig('postgres'));
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [config.database],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(config.database)}`);
    await admin.query(`CREATE DATABASE ${quoteIdent(config.database)}`);
  } finally {
    await admin.end();
  }

  const client = new Client(config);
  await client.connect();
  try {
    await client.query(readFileSync('db/schema.sql', 'utf8'));
  } finally {
    await client.end();
  }
  return config;
}

/** Pool against the test database, for suites that run many queries */
export function testPool(config: TestPgConfig = testPgConfig()) {
  return new Pool({ ...config, max: 4 });
}

/** Wipe all rows while keeping the schema, so each test starts clean */
export async function truncateAll(pool: pkg.Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  if (!rows.length) return;
  const tables = rows.map((row) => quoteIdent(row.tablename)).join(', ');
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

function quoteIdent(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

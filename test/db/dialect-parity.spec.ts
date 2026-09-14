import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kysely, sql } from 'kysely';
import { createSqliteMemoryDb } from '~/server/db/client';
import { migrateToLatest } from '~/server/db/migrations';
import { TABLE_NAMES, type Database } from '~/server/db/schema';
import { isPostgresAvailable, resetTestDatabase } from '../helpers/postgres';
import { createPostgresTestDb } from '../helpers/kysely';

const available = await isPostgresAvailable();

/** schema_migrations is runner bookkeeping, not part of the app's data model */
const IGNORED_TABLES = new Set(['schema_migrations']);

describe.skipIf(!available)('the two dialects describe the same database', () => {
  let sqlite: Kysely<Database>;
  let postgres: Kysely<Database>;

  beforeAll(async () => {
    sqlite = createSqliteMemoryDb();
    await migrateToLatest(sqlite, 'sqlite');
    postgres = createPostgresTestDb(await resetTestDatabase('dl_test_parity'));
    await migrateToLatest(postgres, 'postgres');
  });

  afterAll(async () => {
    await sqlite?.destroy();
    await postgres?.destroy();
  });

  it('has the same tables', async () => {
    expect(await sqliteTables()).toEqual(await postgresTables());
  });

  it('has the same columns in every table', async () => {
    const mismatches: string[] = [];
    for (const table of await sqliteTables()) {
      const [left, right] = await Promise.all([
        sqliteColumns(table),
        postgresColumns(table),
      ]);
      if (JSON.stringify(left) !== JSON.stringify(right)) {
        mismatches.push(`${table}: sqlite=${left.join(',')} postgres=${right.join(',')}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('has the same unique constraints', async () => {
    expect(await sqliteUniques()).toEqual(await postgresUniques());
  });

  it('creates exactly the tables the Database type declares', async () => {
    const expected = TABLE_NAMES.filter((name) => !IGNORED_TABLES.has(name))
      .slice()
      .sort();
    expect(await sqliteTables()).toEqual(expected);
    expect(await postgresTables()).toEqual(expected);
  });

  async function sqliteTables(): Promise<string[]> {
    const rows = await sql<{
      name: string;
    }>`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`.execute(
      sqlite,
    );
    return rows.rows.map((row) => row.name).filter((name) => !IGNORED_TABLES.has(name));
  }

  async function postgresTables(): Promise<string[]> {
    const rows = await sql<{ tablename: string }>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `.execute(postgres);
    return rows.rows
      .map((row) => row.tablename)
      .filter((name) => !IGNORED_TABLES.has(name));
  }

  async function sqliteColumns(table: string): Promise<string[]> {
    const rows = await sql<{
      name: string;
    }>`SELECT name FROM pragma_table_info(${table})`.execute(sqlite);
    return rows.rows.map((row) => row.name).sort();
  }

  async function postgresColumns(table: string): Promise<string[]> {
    const rows = await sql<{ column_name: string }>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `.execute(postgres);
    return rows.rows.map((row) => row.column_name).sort();
  }

  async function sqliteUniques(): Promise<string[]> {
    const constraints: string[] = [];
    for (const table of await sqliteTables()) {
      const indexes = await sql<{ name: string; unique: number; origin: string }>`
        SELECT name, "unique", origin FROM pragma_index_list(${table})
      `.execute(sqlite);
      for (const index of indexes.rows) {
        // origin 'pk' is the primary key, which Postgres reports separately
        if (!index.unique || index.origin === 'pk') continue;
        const columns = await sql<{ name: string }>`
          SELECT name FROM pragma_index_info(${index.name})
        `.execute(sqlite);
        constraints.push(
          `${table}(${columns.rows
            .map((column) => column.name)
            .sort()
            .join(',')})`,
        );
      }
    }
    return constraints.sort();
  }

  async function postgresUniques(): Promise<string[]> {
    const rows = await sql<{ entry: string }>`
      SELECT t.relname || '(' || (
        SELECT string_agg(attname, ',' ORDER BY attname) FROM pg_attribute
        WHERE attrelid = t.oid AND attnum = ANY(c.conkey)
      ) || ')' AS entry
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND c.contype = 'u'
    `.execute(postgres);
    return rows.rows.map((row) => row.entry).sort();
  }
});

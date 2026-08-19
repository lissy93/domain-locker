import { Kysely, PostgresDialect } from 'kysely';
import pkg from 'pg';
import type { Database } from '~/server/db/schema';
import { testPgConfig, type TestPgConfig } from './postgres';

const { Pool } = pkg;

/** Kysely bound to the throwaway test cluster, mirroring the app's type parsers */
export function createPostgresTestDb(config: TestPgConfig = testPgConfig()) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ ...config, max: 4, types: { getTypeParser } as never }),
    }),
  });
}

const PG_TYPE_DATE = 1082;
const PG_TYPE_TIMESTAMP = 1114;
const PG_TYPE_TIMESTAMPTZ = 1184;
const PG_TYPE_NUMERIC = 1700;
const PG_TYPE_INT8 = 20;

function getTypeParser(oid: number, format?: string) {
  if (format === undefined || format === 'text') {
    if (oid === PG_TYPE_DATE) return (value: string) => value;
    if (oid === PG_TYPE_TIMESTAMP || oid === PG_TYPE_TIMESTAMPTZ) {
      return (value: string) => new Date(value).toISOString();
    }
    if (oid === PG_TYPE_NUMERIC || oid === PG_TYPE_INT8) {
      return (value: string) => Number(value);
    }
  }
  return pkg.types.getTypeParser(oid, format as never);
}

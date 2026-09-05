import type { Kysely } from 'kysely';
import { createSqliteMemoryDb, type Backend } from '~/server/db/client';
import { migrateToLatest } from '~/server/db/migrations';
import type { Database } from '~/server/db/schema';
import { isPostgresAvailable, resetTestDatabase } from './postgres';
import { createPostgresTestDb } from './kysely';

export const SELF_HOST_USER = 'a0000000-aaaa-42a0-a0a0-00a000000a69';

const postgresReady = await isPostgresAvailable();

/** Every dialect the contract suites run against, skipping Postgres if absent */
export const BACKENDS: Backend[] = postgresReady ? ['postgres', 'sqlite'] : ['sqlite'];

export async function createMigratedDb(
  backend: Backend,
  databaseName = 'dl_test_repos',
): Promise<Kysely<Database>> {
  if (backend === 'sqlite') {
    const db = createSqliteMemoryDb();
    await migrateToLatest(db, 'sqlite');
    return db;
  }
  const db = createPostgresTestDb(await resetTestDatabase(databaseName));
  await migrateToLatest(db, 'postgres');
  return db;
}

/** Removes every row while keeping the schema, so tests start from a clean slate */
export async function clearData(db: Kysely<Database>): Promise<void> {
  const order = [
    'domain_tags',
    'domain_hosts',
    'notifications',
    'notification_preferences',
    'ip_addresses',
    'ssl_certificates',
    'whois_info',
    'dns_records',
    'domain_costings',
    'domain_statuses',
    'domain_updates',
    'domain_links',
    'uptime',
    'sub_domains',
    'domains',
    'tags',
    'hosts',
    'registrars',
    'billing',
    'user_info',
  ] as const;
  for (const table of order) {
    await db.deleteFrom(table).execute();
  }
}

/**
 * Copies a Postgres database into a fresh SQLite file, for anyone
 * consolidating onto the single-container setup.
 *
 *   DL_PG_HOST=... DL_PG_USER=... DL_PG_PASSWORD=... DL_PG_NAME=... \
 *   DL_SQLITE_PATH=./domain-locker.db npm run migrate:pg-to-sqlite
 *
 * The Postgres database is only read from, never modified.
 */
import { createDb, selectedBackend, sqlitePath } from '../src/server/db/client';
import { migrateToLatest } from '../src/server/db/migrations';
import { TABLE_NAMES } from '../src/server/db/schema';

/** Parents before children, so foreign keys always resolve */
const COPY_ORDER = [
  'users',
  'user_info',
  'billing',
  'registrars',
  'tags',
  'hosts',
  'domains',
  'domain_tags',
  'domain_hosts',
  'whois_info',
  'dns_records',
  'ssl_certificates',
  'ip_addresses',
  'domain_costings',
  'domain_statuses',
  'domain_links',
  'sub_domains',
  'notification_preferences',
  'notifications',
  'domain_updates',
  'uptime',
] as const;

const BATCH = 500;

async function main() {
  if (selectedBackend() !== 'postgres') {
    throw new Error('Set DL_PG_* so the source database can be read');
  }
  const target = process.env['DL_SQLITE_PATH'];
  if (!target) {
    throw new Error('Set DL_SQLITE_PATH to the SQLite file to create');
  }

  const postgres = createDb('postgres');
  // createDb reads DL_PG_*, so the destination is built explicitly
  process.env['DL_PG_HOST'] = '';
  process.env['DL_PG_USER'] = '';
  process.env['DL_PG_PASSWORD'] = '';
  process.env['DL_PG_NAME'] = '';
  const sqlite = createDb('sqlite');

  console.log(`Copying Postgres into ${sqlitePath()}`);
  await migrateToLatest(sqlite, 'sqlite');

  let total = 0;
  for (const table of COPY_ORDER) {
    const rows = await postgres.selectFrom(table).selectAll().execute();
    if (!rows.length) {
      console.log(`  ${table}: empty`);
      continue;
    }

    for (let index = 0; index < rows.length; index += BATCH) {
      await sqlite
        .insertInto(table)
        .values(rows.slice(index, index + BATCH).map(serialise) as never)
        // The schema seeds the self-hosted user, and re-running should be safe
        .onConflict((conflict) => conflict.doNothing())
        .execute();
    }
    total += rows.length;
    console.log(`  ${table}: ${rows.length} rows`);
  }

  const skipped = TABLE_NAMES.filter(
    (name) => !COPY_ORDER.includes(name as (typeof COPY_ORDER)[number]),
  );
  console.log(
    `Copied ${total} rows. Not copied (rebuilt on start): ${skipped.join(', ')}`,
  );

  await postgres.destroy();
  await sqlite.destroy();
}

/** SQLite has no native json, boolean or date types */
function serialise(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => {
      if (value instanceof Date) return [column, value.toISOString()];
      if (typeof value === 'boolean') return [column, Number(value)];
      if (value && typeof value === 'object') return [column, JSON.stringify(value)];
      return [column, value];
    }),
  );
}

main().catch((err) => {
  console.error(`Migration failed: ${(err as Error).message}`);
  process.exitCode = 1;
});

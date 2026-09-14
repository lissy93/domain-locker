import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Kysely, sql } from 'kysely';
import { createSqliteMemoryDb } from '~/server/db/client';
import { MIGRATIONS, migrateToLatest } from '~/server/db/migrations';
import { POSTGRES_DOMAIN_DATES } from '~/server/db/migrations/003-domain-dates';
import type { Database } from '~/server/db/schema';
import { isPostgresAvailable, resetTestDatabase } from '../helpers/postgres';
import { createPostgresTestDb } from '../helpers/kysely';

/** Migrations that skip a dialect are recorded, not applied, so exclude them */
const versionsFor = (backend: 'postgres' | 'sqlite') =>
  MIGRATIONS.filter((migration) => migration.statements[backend]).map(
    (migration) => migration.version,
  );

describe('migration runner (sqlite)', () => {
  let db: Kysely<Database>;

  beforeEach(() => {
    db = createSqliteMemoryDb();
  });

  afterEach(() => db.destroy());

  it('creates the whole schema on a fresh database', async () => {
    const { applied } = await migrateToLatest(db, 'sqlite');

    expect(applied).toEqual(versionsFor('sqlite'));
    await expect(db.selectFrom('domains').selectAll().execute()).resolves.toEqual([]);
  });

  it('is idempotent, so a restart applies nothing', async () => {
    await migrateToLatest(db, 'sqlite');
    const second = await migrateToLatest(db, 'sqlite');

    expect(second.applied).toEqual([]);
  });

  it('seeds the self-hosted user so foreign keys resolve', async () => {
    await migrateToLatest(db, 'sqlite');
    const users = await db.selectFrom('users').select('id').execute();
    expect(users).toEqual([{ id: 'a0000000-aaaa-42a0-a0a0-00a000000a69' }]);
  });

  it('generates a usable uuid when the app omits an id', async () => {
    await migrateToLatest(db, 'sqlite');
    const inserted = await db
      .insertInto('domains')
      .values({ domain_name: 'example.com' })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();

    expect(inserted.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(inserted.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rolls booleans and json through unchanged', async () => {
    await migrateToLatest(db, 'sqlite');
    const domain = await db
      .insertInto('domains')
      .values({ domain_name: 'bools.com' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('uptime')
      .values({ domain_id: domain.id, is_up: true, response_time_ms: 12.5 })
      .execute();
    await db
      .insertInto('user_info')
      .values({ notification_channels: JSON.stringify({ email: { enabled: true } }) })
      .execute();

    const uptime = await db.selectFrom('uptime').selectAll().executeTakeFirstOrThrow();
    expect(uptime.is_up).toBe(true);
    expect(uptime.response_time_ms).toBe(12.5);

    const info = await db.selectFrom('user_info').selectAll().executeTakeFirstOrThrow();
    expect(info.notification_channels).toEqual({ email: { enabled: true } });
  });

  it('enforces foreign keys', async () => {
    await migrateToLatest(db, 'sqlite');
    await expect(
      db
        .insertInto('dns_records')
        .values({
          domain_id: '00000000-0000-4000-8000-000000000000',
          record_type: 'A',
          record_value: '1.2.3.4',
        })
        .execute(),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });
});

const pgAvailable = await isPostgresAvailable();

describe.skipIf(!pgAvailable)('migration runner (postgres)', () => {
  let db: Kysely<Database>;

  afterEach(() => db?.destroy());

  it('creates the schema on an empty database', async () => {
    const config = await resetTestDatabase('dl_test_migrate_fresh');
    await sql`DROP SCHEMA public CASCADE`.execute(createPostgresTestDb(config));
    db = createPostgresTestDb(config);
    await sql`CREATE SCHEMA public`.execute(db);

    const { applied } = await migrateToLatest(db, 'postgres');

    expect(applied).toEqual(versionsFor('postgres'));
    await expect(db.selectFrom('domains').selectAll().execute()).resolves.toEqual([]);
  });

  it('upgrades an existing install without disturbing its rows', async () => {
    const config = await resetTestDatabase('dl_test_migrate_existing');
    db = createPostgresTestDb(config);
    await db
      .insertInto('domains')
      .values({
        user_id: 'a0000000-aaaa-42a0-a0a0-00a000000a69',
        domain_name: 'kept.com',
      })
      .execute();

    const { applied } = await migrateToLatest(db, 'postgres');

    expect(applied).toEqual(versionsFor('postgres'));
    const kept = await db.selectFrom('domains').select('domain_name').execute();
    expect(kept).toEqual([{ domain_name: 'kept.com' }]);
  });

  it('is idempotent across restarts', async () => {
    const config = await resetTestDatabase('dl_test_migrate_repeat');
    db = createPostgresTestDb(config);
    await migrateToLatest(db, 'postgres');
    const second = await migrateToLatest(db, 'postgres');
    expect(second).toEqual({ applied: [] });
  });

  /** schema.sql is re-applied every boot, so edits to it must reach live installs */
  it('re-applies the base schema, so a changed function reaches an existing install', async () => {
    const config = await resetTestDatabase('dl_test_migrate_reapply');
    db = createPostgresTestDb(config);
    await sql`CREATE OR REPLACE FUNCTION "public"."delete_domain"("domain_id" uuid)
                RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$`.execute(db);

    await migrateToLatest(db, 'postgres');

    const domain = await db
      .insertInto('domains')
      .values({
        user_id: 'a0000000-aaaa-42a0-a0a0-00a000000a69',
        domain_name: 'stale-fn.com',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await sql`SELECT delete_domain(${domain.id}::uuid)`.execute(db);
    const left = await db.selectFrom('domains').select('id').execute();
    expect(left).toEqual([]);
  });

  // A server west of Greenwich is where the naive cast loses a day
  it('carries on when the role owns its tables but not the schema', async () => {
    const config = await resetTestDatabase('dl_test_migrate_restricted');
    db = createPostgresTestDb(config);
    // Roles are cluster wide, so drop any left by an earlier run
    await sql`DROP ROLE IF EXISTS dl_restricted`.execute(db);
    await sql`CREATE ROLE dl_restricted LOGIN PASSWORD 'restricted'`.execute(db);
    await sql`GRANT USAGE, CREATE ON SCHEMA public TO dl_restricted`.execute(db);
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE
                ON ALL TABLES IN SCHEMA public TO dl_restricted`.execute(db);
    await db.destroy();

    db = createPostgresTestDb({
      ...config,
      user: 'dl_restricted',
      password: 'restricted',
    });

    const { applied } = await migrateToLatest(db, 'postgres');
    expect(applied).toEqual(versionsFor('postgres'));
    await expect(db.selectFrom('domains').selectAll().execute()).resolves.toEqual([]);
    await expect(db.selectFrom('job_runs').selectAll().execute()).resolves.toEqual([]);
  });

  it('narrows the registry dates without shifting them across a timezone', async () => {
    const config = await resetTestDatabase('dl_test_migrate_dates');
    db = createPostgresTestDb(config, 'America/Los_Angeles');
    // Put the columns back to the type installs before 0.2.6 carry
    await sql`ALTER TABLE domains
                ALTER COLUMN registration_date TYPE timestamptz,
                ALTER COLUMN updated_date TYPE timestamptz`.execute(db);
    // Stored as UTC midnight, which a session-local cast reads as the day before
    await sql`INSERT INTO domains (user_id, domain_name, registration_date, updated_date)
              VALUES ('a0000000-aaaa-42a0-a0a0-00a000000a69', 'summer.com',
                      '2024-07-01T00:00:00Z', '2024-03-01T00:00:00Z')`.execute(db);

    await migrateToLatest(db, 'postgres');

    const row = await db
      .selectFrom('domains')
      .where('domain_name', '=', 'summer.com')
      .select(['registration_date', 'updated_date'])
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      registration_date: '2024-07-01',
      updated_date: '2024-03-01',
    });
  });

  /** Re-running the narrowing against an already-narrowed column must be a no-op */
  it('leaves the dates alone when the columns are already narrowed', async () => {
    const config = await resetTestDatabase('dl_test_migrate_dates_again');
    db = createPostgresTestDb(config, 'America/Los_Angeles');
    await db
      .insertInto('domains')
      .values({
        user_id: 'a0000000-aaaa-42a0-a0a0-00a000000a69',
        domain_name: 'already.com',
        registration_date: '2024-07-01',
      })
      .execute();

    await migrateToLatest(db, 'postgres');
    for (const statement of POSTGRES_DOMAIN_DATES) await sql.raw(statement).execute(db);

    const row = await db
      .selectFrom('domains')
      .where('domain_name', '=', 'already.com')
      .select('registration_date')
      .executeTakeFirstOrThrow();
    expect(row.registration_date).toBe('2024-07-01');
  });
});

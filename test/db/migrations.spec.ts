import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Kysely, sql } from 'kysely';
import { createSqliteMemoryDb } from '~/server/db/client';
import { BASELINE_VERSION, MIGRATIONS, migrateToLatest } from '~/server/db/migrations';
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
    const { applied, baselined } = await migrateToLatest(db, 'sqlite');

    expect(applied).toEqual(versionsFor('sqlite'));
    expect(baselined).toEqual([]);
    await expect(db.selectFrom('domains').selectAll().execute()).resolves.toEqual([]);
  });

  it('is idempotent, so a restart applies nothing', async () => {
    await migrateToLatest(db, 'sqlite');
    const second = await migrateToLatest(db, 'sqlite');

    expect(second.applied).toEqual([]);
    expect(second.baselined).toEqual([]);
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

  it('baselines an existing install instead of replaying DDL', async () => {
    const config = await resetTestDatabase('dl_test_migrate_existing');
    db = createPostgresTestDb(config);
    await db
      .insertInto('domains')
      .values({
        user_id: 'a0000000-aaaa-42a0-a0a0-00a000000a69',
        domain_name: 'kept.com',
      })
      .execute();

    const { applied, baselined } = await migrateToLatest(db, 'postgres');

    // The initial schema is assumed present; later migrations still run
    expect(applied).toEqual(
      versionsFor('postgres').filter((version) => version !== BASELINE_VERSION),
    );
    expect(baselined).toEqual([BASELINE_VERSION]);
    const kept = await db.selectFrom('domains').select('domain_name').execute();
    expect(kept).toEqual([{ domain_name: 'kept.com' }]);
  });

  it('is idempotent across restarts', async () => {
    const config = await resetTestDatabase('dl_test_migrate_repeat');
    db = createPostgresTestDb(config);
    await migrateToLatest(db, 'postgres');
    const second = await migrateToLatest(db, 'postgres');
    expect(second).toEqual({ applied: [], baselined: [] });
  });

  it('narrows the registry dates without shifting them across a timezone', async () => {
    const config = await resetTestDatabase('dl_test_migrate_dates');
    db = createPostgresTestDb(config);
    // Put the columns back to the type installs before 0.2.6 carry
    await sql`ALTER TABLE domains
                ALTER COLUMN registration_date TYPE timestamptz,
                ALTER COLUMN updated_date TYPE timestamptz`.execute(db);
    await db
      .insertInto('domains')
      .values({
        user_id: 'a0000000-aaaa-42a0-a0a0-00a000000a69',
        domain_name: 'summer.com',
        // A midsummer date is the one a UTC conversion would move to the day before
        registration_date: '2024-07-01',
        updated_date: '2024-07-01',
      })
      .execute();

    await migrateToLatest(db, 'postgres');

    const row = await db
      .selectFrom('domains')
      .where('domain_name', '=', 'summer.com')
      .select(['registration_date', 'updated_date'])
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      registration_date: '2024-07-01',
      updated_date: '2024-07-01',
    });
  });
});

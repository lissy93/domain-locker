import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDb } from '~/server/db/client';
import { migrateToLatest } from '~/server/db/migrations';
import type { Database } from '~/server/db/schema';
import { resetRepos } from '~/server/db/repos';
import {
  BACKENDS,
  SELF_HOST_USER,
  clearData,
  createMigratedDb,
} from '../helpers/backends';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe.each(BACKENDS)('cleanup job (%s)', (backend) => {
  let db: Kysely<Database>;
  let runCleanup: typeof import('~/server/jobs/cleanup').runCleanup;
  let domainId: string;
  const dataDir = mkdtempSync(join(tmpdir(), 'dl-cleanup-'));
  const dbPath = join(dataDir, 'test.db');

  beforeAll(async () => {
    // SQLite gets a real file in WAL mode, so compaction runs as it does in production
    if (backend === 'sqlite') {
      vi.stubEnv('DL_SQLITE_PATH', dbPath);
      db = createDb('sqlite');
      await migrateToLatest(db, 'sqlite');
    } else {
      db = await createMigratedDb(backend, 'dl_test_cleanup');
    }
    // The job talks to the shared connection, so point it at this database
    const client = await import('~/server/db/client');
    vi.spyOn(client, 'getDb').mockReturnValue(db);
    vi.spyOn(client, 'currentBackend').mockReturnValue(backend);
    resetRepos();
    ({ runCleanup } = await import('~/server/jobs/cleanup'));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    resetRepos();
    await db?.destroy();
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    vi.stubEnv('DL_HISTORY_RETENTION_DAYS', undefined);
    vi.stubEnv('DL_NOTIFICATIONS_RETENTION_DAYS', undefined);
    await clearData(db);
    ({ id: domainId } = await db
      .insertInto('domains')
      .values({ user_id: SELF_HOST_USER, domain_name: 'old.com' })
      .returning('id')
      .executeTakeFirstOrThrow());

    const owned = { domain_id: domainId, user_id: SELF_HOST_USER };
    await db
      .insertInto('domain_updates')
      .values([
        { ...owned, change: 'registrar', change_type: 'updated', date: daysAgo(100) },
        { ...owned, change: 'registrar', change_type: 'recent', date: daysAgo(1) },
      ])
      .execute();
    await db
      .insertInto('notifications')
      .values(
        [
          { change_type: 'registrar', created_at: daysAgo(100) },
          { change_type: 'expiry_domain', created_at: daysAgo(100) },
          { change_type: 'recent', created_at: daysAgo(1) },
        ].map((row) => ({ ...owned, ...row, message: 'test', sent: true, read: true })),
      )
      .execute();
  });

  afterEach(() => vi.unstubAllEnvs());

  const changeTypes = async (table: 'domain_updates' | 'notifications') =>
    (
      await db.selectFrom(table).select('change_type').orderBy('change_type').execute()
    ).map((row) => row.change_type);

  it('keeps everything when no retention is set', async () => {
    await runCleanup();

    expect(await changeTypes('domain_updates')).toEqual(['recent', 'updated']);
    expect(await changeTypes('notifications')).toEqual([
      'expiry_domain',
      'recent',
      'registrar',
    ]);
  });

  /** Reminders double as the record that stops an expiry reminder being resent */
  it('prunes past the retention window but keeps expiry reminders', async () => {
    vi.stubEnv('DL_HISTORY_RETENTION_DAYS', '30');
    vi.stubEnv('DL_NOTIFICATIONS_RETENTION_DAYS', '30');

    expect(await runCleanup()).toMatchObject({ history: 1, notifications: 1 });
    expect(await changeTypes('domain_updates')).toEqual(['recent']);
    expect(await changeTypes('notifications')).toEqual(['expiry_domain', 'recent']);
  });

  it.runIf(backend === 'sqlite')(
    'compacts the file once a tenth of it is free',
    async () => {
      const addHistory = (count: number, days: number) =>
        db
          .insertInto('domain_updates')
          .values(
            Array.from({ length: count }, () => ({
              domain_id: domainId,
              user_id: SELF_HOST_USER,
              change: 'registrar',
              change_type: 'updated',
              old_value: 'x'.repeat(1000),
              date: daysAgo(days),
            })),
          )
          .execute();
      const freePages = async () =>
        (
          await sql<{
            pages: number;
          }>`SELECT freelist_count AS pages FROM pragma_freelist_count()`.execute(db)
        ).rows[0].pages;
      vi.stubEnv('DL_HISTORY_RETENTION_DAYS', '30');

      await addHistory(400, 1);
      await addHistory(20, 100);
      await runCleanup();
      expect(await freePages()).toBeGreaterThan(0);

      await addHistory(400, 100);
      await runCleanup();
      expect(await freePages()).toBe(0);
      expect(statSync(`${dbPath}-wal`).size).toBe(0);
    },
  );
});

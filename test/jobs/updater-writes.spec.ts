import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '~/server/db/schema';
import { resetRepos } from '~/server/db/repos';
import {
  BACKENDS,
  SELF_HOST_USER,
  clearData,
  createMigratedDb,
} from '../helpers/backends';

type Fns = {
  updateDomainDates: typeof import('~/server/jobs/updater/fns/dates').updateDomainDates;
  updateExpiryDate: typeof import('~/server/jobs/updater/fns/expiry').updateExpiryDate;
  updateSSL: typeof import('~/server/jobs/updater/fns/ssl').updateSSL;
};

/**
 * The updater still writes hand-rolled SQL, which has to parse on both
 * dialects. Postgres-only casts used to make every one of these a no-op
 * on SQLite.
 */
describe.each(BACKENDS)('updater writes (%s)', (backend) => {
  let db: Kysely<Database>;
  let fns: Fns;
  let domainId: string;

  beforeAll(async () => {
    db = await createMigratedDb(backend, 'dl_test_updater_writes');
    const client = await import('~/server/db/client');
    const ready = await import('~/server/db/ready');
    vi.spyOn(client, 'getDb').mockReturnValue(db);
    vi.spyOn(client, 'currentBackend').mockReturnValue(backend);
    vi.spyOn(ready, 'ensureMigrated').mockResolvedValue(undefined);
    // Repos are cached per connection, so rebind to this backend
    resetRepos();
    fns = {
      updateDomainDates: (await import('~/server/jobs/updater/fns/dates'))
        .updateDomainDates,
      updateExpiryDate: (await import('~/server/jobs/updater/fns/expiry'))
        .updateExpiryDate,
      updateSSL: (await import('~/server/jobs/updater/fns/ssl')).updateSSL,
    };
  });

  afterAll(async () => {
    resetRepos();
    vi.restoreAllMocks();
    await db?.destroy();
  });

  beforeEach(async () => {
    await clearData(db);
    const row = await db
      .insertInto('domains')
      .values({ user_id: SELF_HOST_USER, domain_name: 'updated.com' })
      .returning('id')
      .executeTakeFirstOrThrow();
    domainId = row.id;
  });

  it('backfills the registry dates as plain dates', async () => {
    const changes: string[] = [];
    await fns.updateDomainDates(
      { id: domainId, domain_name: 'updated.com' },
      { dates: { creation_date: '1995-12-14', updated_date: '2024-07-01' } } as never,
      changes,
    );

    const row = await db
      .selectFrom('domains')
      .where('id', '=', domainId)
      .select(['registration_date', 'updated_date'])
      .executeTakeFirstOrThrow();

    expect(changes.slice().sort()).toEqual(['Registration Date', 'Updated Date']);
    expect(row.registration_date).toBe('1995-12-14');
    expect(row.updated_date).toBe('2024-07-01');
  });

  it('writes a new expiry date', async () => {
    const changes: string[] = [];
    await fns.updateExpiryDate(
      { id: domainId, domain_name: 'updated.com' },
      { dates: { expiry_date: '2030-07-01' } } as never,
      changes,
    );

    const row = await db
      .selectFrom('domains')
      .where('id', '=', domainId)
      .select('expiry_date')
      .executeTakeFirstOrThrow();

    expect(changes).toEqual(['Expiry Date']);
    expect(row.expiry_date).toBe('2030-07-01');
  });

  it('inserts a certificate, then updates the fields that moved', async () => {
    const changes: string[] = [];
    const domain = { id: domainId, domain_name: 'updated.com' };
    await fns.updateSSL(
      domain,
      {
        ssl: {
          issuer: 'Lets Encrypt',
          subject: 'updated.com',
          valid_from: '2026-01-01',
          valid_to: '2026-04-01',
          key_size: 2048,
        },
      } as never,
      changes,
    );

    const inserted = await db
      .selectFrom('ssl_certificates')
      .where('domain_id', '=', domainId)
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(inserted.issuer).toBe('Lets Encrypt');
    expect(inserted.valid_to).toBe('2026-04-01');
    expect(Number(inserted.key_size)).toBe(2048);

    await fns.updateSSL(
      domain,
      {
        ssl: {
          issuer: 'Lets Encrypt',
          subject: 'updated.com',
          valid_from: '2026-04-01',
          valid_to: '2026-07-01',
          key_size: 4096,
        },
      } as never,
      changes,
    );

    const updated = await db
      .selectFrom('ssl_certificates')
      .where('domain_id', '=', domainId)
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(updated.valid_to).toBe('2026-07-01');
    expect(Number(updated.key_size)).toBe(4096);
  });
});

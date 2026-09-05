import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '~/server/db/schema';
import { SELF_HOST_USER, clearData, createMigratedDb } from '../helpers/backends';

/**
 * The updater used to reach its own /api/domain-info over HTTP, which meant
 * guessing the port it was served on. Scheduled runs have no request to guess
 * from, so the lookup has to work with no server listening at all.
 */
describe('updater lookup', () => {
  let db: Kysely<Database>;
  let runUpdater: typeof import('~/server/jobs/updater').runUpdater;
  let lookup: typeof import('~/server/utils/domain-info');
  let domainId: string;

  beforeAll(async () => {
    db = await createMigratedDb('sqlite');
    const client = await import('~/server/db/client');
    const ready = await import('~/server/db/ready');
    vi.spyOn(client, 'getDb').mockReturnValue(db);
    vi.spyOn(client, 'currentBackend').mockReturnValue('sqlite');
    vi.spyOn(ready, 'ensureMigrated').mockResolvedValue(undefined);
    lookup = await import('~/server/utils/domain-info');
    runUpdater = (await import('~/server/jobs/updater')).runUpdater;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await db?.destroy();
  });

  beforeEach(async () => {
    await clearData(db);
    const row = await db
      .insertInto('domains')
      .values({ user_id: SELF_HOST_USER, domain_name: 'example.com' })
      .returning('id')
      .executeTakeFirstOrThrow();
    domainId = row.id;
  });

  it('runs with no server listening, and writes what the lookup returned', async () => {
    vi.spyOn(lookup, 'lookupDomainInfo').mockResolvedValue({
      domainInfo: {
        domainName: 'example.com',
        status: [],
        ip_addresses: { ipv4: ['93.184.216.34'], ipv6: [] },
        dates: {
          creation_date: '1995-08-14',
          updated_date: '2024-07-01',
          expiry_date: '2030-08-13',
        },
        registrar: { name: 'RESERVED-IANA', id: '376', url: '', registryDomainId: '' },
        whois: { name: 'IANA' },
        abuse: {},
        host: null,
        dns: { nameServers: ['a.iana-servers.net'], mxRecords: [], txtRecords: [] },
        ssl: {},
      } as never,
    });

    const result = await runUpdater();

    expect(result.checked).toBe(1);
    expect(result.results[0].error).toBeUndefined();

    const row = await db
      .selectFrom('domains')
      .where('id', '=', domainId)
      .select(['expiry_date', 'registration_date', 'updated_date'])
      .executeTakeFirstOrThrow();
    expect(row.expiry_date).toBe('2030-08-13');
    expect(row.registration_date).toBe('1995-08-14');
    expect(row.updated_date).toBe('2024-07-01');
  });

  it('reports a lookup failure against the domain instead of throwing', async () => {
    vi.spyOn(lookup, 'lookupDomainInfo').mockRejectedValue(new Error('WHOIS refused'));

    const result = await runUpdater();

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(0);
    expect(result.results[0]).toMatchObject({ domain: 'example.com' });
    expect(result.results[0].error).toContain('WHOIS refused');
  });

  it('moves a domain to the back of the queue even when its lookup failed', async () => {
    vi.spyOn(lookup, 'lookupDomainInfo').mockRejectedValue(new Error('WHOIS refused'));
    await db
      .updateTable('domains')
      .set({ updated_at: '2020-01-01T00:00:00.000Z' })
      .where('id', '=', domainId)
      .execute();

    await runUpdater();

    const row = await db
      .selectFrom('domains')
      .where('id', '=', domainId)
      .select('updated_at')
      .executeTakeFirstOrThrow();
    expect(row.updated_at > '2020-01-01T00:00:00.000Z').toBe(true);
  });

  it('rejects a domain name the lookup would not accept', async () => {
    const spy = vi.spyOn(lookup, 'lookupDomainInfo');
    await db
      .updateTable('domains')
      .set({ domain_name: 'not a domain' })
      .where('id', '=', domainId)
      .execute();

    const result = await runUpdater();

    expect(spy).not.toHaveBeenCalled();
    expect(result.results[0].error).toContain('not a domain');
  });
});

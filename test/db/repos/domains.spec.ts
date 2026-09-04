import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { domainsRepo } from '~/server/db/repos/domains';
import type { Database } from '~/server/db/schema';
import {
  BACKENDS,
  SELF_HOST_USER,
  clearData,
  createMigratedDb,
} from '../../helpers/backends';
import { ASSET_TYPES } from '~/types/common';

/** One behavioural contract, executed against every supported dialect */
describe.each(BACKENDS)('domains repo (%s)', (backend) => {
  let db: Kysely<Database>;
  let repo: ReturnType<typeof domainsRepo>;

  beforeAll(async () => {
    db = await createMigratedDb(backend, 'dl_test_repo_domains');
    repo = domainsRepo(db);
  });

  afterAll(() => db?.destroy());

  beforeEach(() => clearData(db));

  it('returns an empty list before anything is added', async () => {
    expect(await repo.list()).toEqual([]);
    expect(await repo.count()).toBe(0);
  });

  it('reads back a domain with all of its relations', async () => {
    await seedFullDomain(db, 'example.com');

    const [domain] = await repo.list();

    expect(domain.domain_name).toBe('example.com');
    expect(domain.registrar).toEqual({ name: 'Test Registrar', url: 'https://reg.test' });
    expect(domain.whois?.['organization']).toBe('Test Org');
    expect(domain.domain_costings).toEqual({
      purchase_price: 10.5,
      current_value: 20,
      renewal_cost: 12,
      auto_renew: true,
    });
    expect(domain.ip_addresses).toEqual([{ ip_address: '1.2.3.4', is_ipv6: false }]);
    expect(domain.tags).toEqual(['production']);
    expect(domain.dns).toEqual({
      mxRecords: ['mail.example.com'],
      txtRecords: ['v=spf1'],
      nameServers: ['ns1.example.com'],
    });
    expect(domain.ssl?.['issuer']).toBe('Test CA');
    expect(domain.host?.['ip']).toBe('9.9.9.9');
    expect(domain.statusCodes).toEqual(['clientTransferProhibited']);
    expect(domain.notification_preferences).toEqual([
      { notification_type: 'expiry', is_enabled: true },
    ]);
    expect(domain.sub_domains).toEqual([{ name: 'www', sd_info: null }]);
    expect(domain.domain_links).toEqual([
      { link_name: 'Docs', link_url: 'https://docs.test', link_description: null },
    ]);
  });

  it('leaves absent relations empty rather than fabricating them', async () => {
    await db.insertInto('domains').values(bareDomain('bare.com')).execute();

    const [domain] = await repo.list();

    expect(domain.registrar).toBeNull();
    expect(domain.whois).toBeNull();
    expect(domain.domain_costings).toBeNull();
    expect(domain.ssl).toBeNull();
    expect(domain.host).toBeNull();
    expect(domain.ip_addresses).toEqual([]);
    expect(domain.tags).toEqual([]);
    expect(domain.statusCodes).toEqual([]);
    expect(domain.dns).toEqual({ mxRecords: [], txtRecords: [], nameServers: [] });
  });

  it('never returns another user domains', async () => {
    await db.insertInto('domains').values(bareDomain('mine.com')).execute();
    await db
      .insertInto('domains')
      .values({
        ...bareDomain('theirs.com'),
        user_id: 'b0000000-bbbb-42b0-b0b0-00b000000b69',
      })
      .execute();

    const names = (await repo.list()).map((domain) => domain.domain_name);
    expect(names).toEqual(['mine.com']);
    expect(await repo.count()).toBe(1);
    expect(await repo.exists('theirs.com')).toBe(false);
  });

  it('finds a domain by name and by id', async () => {
    const id = await seedFullDomain(db, 'lookup.com');

    expect((await repo.getByName('lookup.com'))?.id).toBe(id);
    expect((await repo.getById(id))?.domain_name).toBe('lookup.com');
    expect(await repo.getByName('missing.com')).toBeNull();
    expect(await repo.getById('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('lists domain names in lower case', async () => {
    await db.insertInto('domains').values(bareDomain('MiXeD.CoM')).execute();
    expect(await repo.listNames()).toEqual(['mixed.com']);
  });

  it('reports expirations', async () => {
    await db
      .insertInto('domains')
      .values({ ...bareDomain('expiring.com'), expiry_date: '2027-01-15' })
      .execute();

    expect(await repo.expirations()).toEqual([
      { domain: 'expiring.com', expiration: '2027-01-15' },
    ]);
  });

  it('filters by tag and by status', async () => {
    await seedFullDomain(db, 'tagged.com');
    await db.insertInto('domains').values(bareDomain('plain.com')).execute();

    expect((await repo.listByTag('production')).map((d) => d.domain_name)).toEqual([
      'tagged.com',
    ]);
    expect((await repo.listByTag('nope')).map((d) => d.domain_name)).toEqual([]);
    expect(
      (await repo.listByStatus('clientTransferProhibited')).map((d) => d.domain_name),
    ).toEqual(['tagged.com']);
  });

  it('groups domains by epp code, including codes with no matches', async () => {
    await seedFullDomain(db, 'held.com');

    const grouped = await repo.byEppCodes(['clientTransferProhibited', 'clientHold']);

    expect(grouped['clientTransferProhibited']).toEqual([
      { domainId: expect.any(String), domainName: 'held.com' },
    ]);
    expect(grouped['clientHold']).toEqual([]);
    expect(await repo.byEppCodes([])).toEqual({});
  });

  it('counts domains per status', async () => {
    await seedFullDomain(db, 'one.com');
    await seedFullDomain(db, 'two.com');

    expect(await repo.statusesWithCounts()).toEqual([
      { eppCode: 'clientTransferProhibited', domainCount: 2 },
    ]);
  });

  it('counts assets, scoped to this user', async () => {
    await seedFullDomain(db, 'assets.com');

    expect(await repo.assetCount('domains')).toBe(1);
    expect(await repo.assetCount('ip_addresses')).toBe(1);
    expect(await repo.assetCount('dns_records')).toBe(3);
    expect(await repo.assetCount('tags')).toBe(1);
    expect(await repo.assetCount('hosts')).toBe(1);
    expect(await repo.assetCount('subdomains')).toBe(1);
    expect(await repo.assetCount('links')).toBe(1);
    expect(await repo.assetCount('ssl_certificates')).toBe(1);
    expect(await repo.assetCount('domain_statuses')).toBe(1);
  });

  it('counts every asset type the UI can ask for', async () => {
    for (const assetType of ASSET_TYPES) {
      await expect(repo.assetCount(assetType)).resolves.toBeTypeOf('number');
    }
  });

  it('rejects an unknown asset type', async () => {
    await expect(
      repo.assetCount('nonsense' as Parameters<typeof repo.assetCount>[0]),
    ).rejects.toThrow(/Unknown asset type/);
  });

  it('hands the updater the least recently refreshed domains first', async () => {
    for (const [name, refreshedAt] of [
      ['fresh.com', '2026-03-03T00:00:00.000Z'],
      ['stale.com', '2026-01-01T00:00:00.000Z'],
      ['older.com', '2026-02-02T00:00:00.000Z'],
    ]) {
      await db
        .insertInto('domains')
        .values({ ...bareDomain(name), updated_at: refreshedAt })
        .execute();
    }

    const batch = await repo.listStalest(2);
    expect(batch.map((domain) => domain.domain_name)).toEqual(['stale.com', 'older.com']);

    await repo.markRefreshed(batch[0].id);
    const next = await repo.listStalest(2);
    expect(next.map((domain) => domain.domain_name)).toEqual(['older.com', 'fresh.com']);
  });

  it('does not let a domain with duplicate whois rows eat a second batch slot', async () => {
    const stale = await db
      .insertInto('domains')
      .values({ ...bareDomain('stale.com'), updated_at: '2026-01-01T00:00:00.000Z' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('whois_info')
      .values([
        { domain_id: stale.id, organization: 'First' },
        { domain_id: stale.id, organization: 'Second' },
      ])
      .execute();
    await db
      .insertInto('domains')
      .values({ ...bareDomain('next.com'), updated_at: '2026-02-02T00:00:00.000Z' })
      .execute();

    const names = (await repo.listStalest(2)).map((domain) => domain.domain_name);
    expect(names).toContain('next.com');
  });

  describe('remove', () => {
    it('deletes the domain and everything hanging off it', async () => {
      const id = await seedFullDomain(db, 'gone.com');

      expect(await repo.remove(id)).toBe(true);

      expect(await repo.list()).toEqual([]);
      for (const table of ['ip_addresses', 'dns_records', 'sub_domains'] as const) {
        expect(await db.selectFrom(table).selectAll().execute()).toEqual([]);
      }
    });

    it('clears records the user no longer references', async () => {
      const id = await seedFullDomain(db, 'orphans.com');
      await repo.remove(id);

      for (const table of ['tags', 'hosts', 'registrars'] as const) {
        expect(await db.selectFrom(table).selectAll().execute()).toEqual([]);
      }
    });

    it('keeps records another domain still uses', async () => {
      // Both domains share the same tag, host and registrar
      const keptId = await seedFullDomain(db, 'kept.com');
      const goneId = await seedFullDomain(db, 'gone.com');

      await repo.remove(goneId);

      expect((await repo.list()).map((d) => d.domain_name)).toEqual(['kept.com']);
      expect(await db.selectFrom('tags').selectAll().execute()).toHaveLength(1);
      expect((await repo.getById(keptId))?.tags).toEqual(['production']);
    });

    it('refuses to delete a domain owned by someone else', async () => {
      const other = await db
        .insertInto('domains')
        .values({
          ...bareDomain('theirs.com'),
          user_id: 'b0000000-bbbb-42b0-b0b0-00b000000b69',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      expect(await repo.remove(other.id)).toBe(false);
      expect(await db.selectFrom('domains').selectAll().execute()).toHaveLength(1);
    });
  });
});

function bareDomain(name: string) {
  return { user_id: SELF_HOST_USER, domain_name: name };
}

/** A domain with one row in every related table, for relation assertions */
async function seedFullDomain(db: Kysely<Database>, name: string): Promise<string> {
  const registrar = await db
    .insertInto('registrars')
    .values({ name: 'Test Registrar', url: 'https://reg.test', user_id: SELF_HOST_USER })
    .onConflict((conflict) => conflict.columns(['user_id', 'name']).doNothing())
    .returning('id')
    .executeTakeFirst();
  const registrarId =
    registrar?.id ??
    (
      await db
        .selectFrom('registrars')
        .where('name', '=', 'Test Registrar')
        .select('id')
        .executeTakeFirstOrThrow()
    ).id;

  const domain = await db
    .insertInto('domains')
    .values({ ...bareDomain(name), registrar_id: registrarId })
    .returning('id')
    .executeTakeFirstOrThrow();
  const domainId = domain.id;

  const tag = await db
    .insertInto('tags')
    .values({ name: 'production', user_id: SELF_HOST_USER })
    .onConflict((conflict) => conflict.columns(['user_id', 'name']).doNothing())
    .returning('id')
    .executeTakeFirst();
  const tagId =
    tag?.id ??
    (
      await db
        .selectFrom('tags')
        .where('name', '=', 'production')
        .select('id')
        .executeTakeFirstOrThrow()
    ).id;

  const host = await db
    .insertInto('hosts')
    .values({ ip: '9.9.9.9', isp: 'Test ISP', user_id: SELF_HOST_USER })
    .onConflict((conflict) => conflict.columns(['user_id', 'ip']).doNothing())
    .returning('id')
    .executeTakeFirst();
  const hostId =
    host?.id ??
    (
      await db
        .selectFrom('hosts')
        .where('ip', '=', '9.9.9.9')
        .select('id')
        .executeTakeFirstOrThrow()
    ).id;

  await db
    .insertInto('domain_tags')
    .values({ domain_id: domainId, tag_id: tagId })
    .execute();
  await db
    .insertInto('domain_hosts')
    .values({ domain_id: domainId, host_id: hostId })
    .execute();
  await db
    .insertInto('whois_info')
    .values({ domain_id: domainId, organization: 'Test Org', country: 'GB' })
    .execute();
  await db
    .insertInto('domain_costings')
    .values({
      domain_id: domainId,
      purchase_price: 10.5,
      current_value: 20,
      renewal_cost: 12,
      auto_renew: true,
    })
    .execute();
  await db
    .insertInto('ip_addresses')
    .values({ domain_id: domainId, ip_address: '1.2.3.4', is_ipv6: false })
    .execute();
  await db
    .insertInto('ssl_certificates')
    .values({ domain_id: domainId, issuer: 'Test CA', key_size: 2048 })
    .execute();
  await db
    .insertInto('dns_records')
    .values([
      { domain_id: domainId, record_type: 'MX', record_value: 'mail.example.com' },
      { domain_id: domainId, record_type: 'TXT', record_value: 'v=spf1' },
      { domain_id: domainId, record_type: 'NS', record_value: 'ns1.example.com' },
    ])
    .execute();
  await db
    .insertInto('domain_statuses')
    .values({ domain_id: domainId, status_code: 'clientTransferProhibited' })
    .execute();
  await db
    .insertInto('notification_preferences')
    .values({ domain_id: domainId, notification_type: 'expiry', is_enabled: true })
    .execute();
  await db
    .insertInto('sub_domains')
    .values({ domain_id: domainId, name: 'www' })
    .execute();
  await db
    .insertInto('domain_links')
    .values({ domain_id: domainId, link_name: 'Docs', link_url: 'https://docs.test' })
    .execute();

  return domainId;
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { domainsRepo, type SaveDomainInput } from '~/server/db/repos/domains';
import type { Database } from '~/server/db/schema';
import { BACKENDS, clearData, createMigratedDb } from '../../helpers/backends';

const FULL_INPUT: SaveDomainInput = {
  domain: {
    domain_name: 'written.com',
    expiry_date: '2027-06-01',
    notes: 'A note',
    registrar: { name: 'Namecheap', url: 'https://namecheap.com' },
  },
  tags: ['production', 'client-work'],
  notifications: [
    { type: 'expiry', isEnabled: true },
    { type: 'ssl', isEnabled: false },
  ],
  statuses: ['clientTransferProhibited'],
  ipAddresses: [
    { ipAddress: '1.2.3.4', isIpv6: false },
    { ipAddress: '2001:db8::1', isIpv6: true },
  ],
  ssl: { issuer: 'Lets Encrypt', key_size: 2048, valid_to: '2027-01-01' },
  whois: { organization: 'Example Ltd', country: 'GB' },
  dns: { mxRecords: ['mx1.test'], txtRecords: ['v=spf1'], nameServers: ['ns1.test'] },
  host: { ip: '8.8.8.8', isp: 'Google', lat: 37.4, lon: -122.1 },
  subdomains: [{ name: 'www' }, { name: 'api', sd_info: { ports: [443] } }],
  links: [{ link_name: 'Docs', link_url: 'https://docs.test' }],
};

describe.each(BACKENDS)('domain writes (%s)', (backend) => {
  let db: Kysely<Database>;
  let repo: ReturnType<typeof domainsRepo>;

  beforeAll(async () => {
    db = await createMigratedDb(backend, 'dl_test_repo_writes');
    repo = domainsRepo(db);
  });

  afterAll(() => db?.destroy());

  beforeEach(() => clearData(db));

  it('saves a domain with every relation and reads it straight back', async () => {
    const saved = await repo.save(FULL_INPUT);

    expect(saved).not.toBeNull();
    expect(saved?.domain_name).toBe('written.com');
    expect(saved?.expiry_date).toBe('2027-06-01');
    expect(saved?.notes).toBe('A note');
    expect(saved?.registrar).toEqual({
      name: 'Namecheap',
      url: 'https://namecheap.com',
    });
    expect(saved?.tags.slice().sort()).toEqual(['client-work', 'production']);
    expect(saved?.ip_addresses).toHaveLength(2);
    expect(saved?.ssl?.['issuer']).toBe('Lets Encrypt');
    expect(saved?.ssl?.['key_size']).toBe(2048);
    expect(saved?.whois?.['organization']).toBe('Example Ltd');
    expect(saved?.host?.['ip']).toBe('8.8.8.8');
    expect(saved?.dns).toEqual({
      mxRecords: ['mx1.test'],
      txtRecords: ['v=spf1'],
      nameServers: ['ns1.test'],
    });
    expect(saved?.statusCodes).toEqual(['clientTransferProhibited']);
    expect(saved?.notification_preferences.slice().sort(byType)).toEqual([
      { notification_type: 'expiry', is_enabled: true },
      { notification_type: 'ssl', is_enabled: false },
    ]);
    expect(saved?.domain_links).toEqual([
      { link_name: 'Docs', link_url: 'https://docs.test', link_description: null },
    ]);
  });

  it('returns subdomain metadata as the json string the UI parses', async () => {
    const saved = await repo.save(FULL_INPUT);
    const api = saved?.sub_domains.find((sub) => sub.name === 'api');
    expect(JSON.parse(api?.sd_info as string)).toEqual({ ports: [443] });
    const www = saved?.sub_domains.find((sub) => sub.name === 'www');
    expect(www?.sd_info).toBeNull();
  });

  it('saves the host straight from the lookup API, whose field names differ', async () => {
    const saved = await repo.save({
      domain: { domain_name: 'looked-up.com' },
      host: {
        query: '9.9.9.9',
        isp: 'Quad9',
        org: 'Quad9 Foundation',
        as: 'AS19281 Quad9',
        city: 'Zurich',
        regionName: 'Zurich',
        country: 'Switzerland',
        lat: 47.36,
        lon: 8.55,
      },
    });

    expect(saved?.host).toMatchObject({
      ip: '9.9.9.9',
      isp: 'Quad9',
      as_number: 'AS19281 Quad9',
      region: 'Zurich',
      country: 'Switzerland',
    });
  });

  it('saves a bare domain without inventing relations', async () => {
    const saved = await repo.save({ domain: { domain_name: 'bare.com' } });

    expect(saved?.registrar).toBeNull();
    expect(saved?.tags).toEqual([]);
    expect(saved?.ssl).toBeNull();
    expect(saved?.whois).toBeNull();
    expect(saved?.host).toBeNull();
  });

  it('reuses an existing registrar rather than duplicating it', async () => {
    await repo.save(FULL_INPUT);
    await repo.save({
      ...FULL_INPUT,
      domain: { ...FULL_INPUT.domain, domain_name: 'second.com' },
    });

    const registrars = await db.selectFrom('registrars').selectAll().execute();
    expect(registrars).toHaveLength(1);
  });

  it('reuses tags and hosts across domains', async () => {
    await repo.save(FULL_INPUT);
    await repo.save({
      ...FULL_INPUT,
      domain: { ...FULL_INPUT.domain, domain_name: 'second.com' },
    });

    expect(await db.selectFrom('tags').selectAll().execute()).toHaveLength(2);
    expect(await db.selectFrom('hosts').selectAll().execute()).toHaveLength(1);
    expect(await db.selectFrom('domain_hosts').selectAll().execute()).toHaveLength(2);
  });

  it('rolls the whole save back if a relation fails', async () => {
    await expect(
      repo.save({
        ...FULL_INPUT,
        domain: { ...FULL_INPUT.domain, domain_name: 'doomed.com' },
        statuses: [null as unknown as string],
      }),
    ).rejects.toThrow();

    expect(await repo.getByName('doomed.com')).toBeNull();
    expect(await repo.count()).toBe(0);
  });

  describe('update', () => {
    it('replaces the relations it is given', async () => {
      const saved = await repo.save(FULL_INPUT);

      const updated = await repo.update(saved!.id, {
        domain: {
          domain_name: 'written.com',
          expiry_date: '2028-01-01',
          notes: 'Edited',
        },
        tags: ['archived'],
        links: [
          {
            link_name: 'Panel',
            link_url: 'https://panel.test',
            link_description: 'Control panel',
          },
        ],
      });

      expect(updated?.expiry_date).toBe('2028-01-01');
      expect(updated?.notes).toBe('Edited');
      expect(updated?.tags).toEqual(['archived']);
      expect(updated?.domain_links).toEqual([
        {
          link_name: 'Panel',
          link_url: 'https://panel.test',
          link_description: 'Control panel',
        },
      ]);
    });

    it('leaves relations it was not given alone', async () => {
      const saved = await repo.save(FULL_INPUT);

      const updated = await repo.update(saved!.id, {
        domain: { domain_name: 'written.com', notes: 'Only notes' },
      });

      expect(updated?.notes).toBe('Only notes');
      expect(updated?.tags.slice().sort()).toEqual(['client-work', 'production']);
      expect(updated?.ip_addresses).toHaveLength(2);
      expect(updated?.statusCodes).toEqual(['clientTransferProhibited']);
    });

    it('keeps dates the edit did not carry, rather than clearing them', async () => {
      const saved = await repo.save(FULL_INPUT);

      const updated = await repo.update(saved!.id, {
        domain: { domain_name: 'written.com', notes: 'Only notes' },
      });

      expect(updated?.expiry_date).toBe('2027-06-01');
    });

    it('keeps the registrar when the edit omits one', async () => {
      const saved = await repo.save(FULL_INPUT);

      const updated = await repo.update(saved!.id, {
        domain: { domain_name: 'written.com', notes: 'No registrar given' },
      });

      expect(updated?.registrar?.name).toBe('Namecheap');
    });

    it('drops tags when given an empty list', async () => {
      const saved = await repo.save(FULL_INPUT);
      const updated = await repo.update(saved!.id, {
        domain: { domain_name: 'written.com' },
        tags: [],
      });
      expect(updated?.tags).toEqual([]);
    });

    it('refuses to update a domain owned by someone else', async () => {
      const other = await db
        .insertInto('domains')
        .values({
          user_id: 'b0000000-bbbb-42b0-b0b0-00b000000b69',
          domain_name: 'theirs.com',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      expect(
        await repo.update(other.id, {
          domain: { domain_name: 'theirs.com', notes: 'x' },
        }),
      ).toBeNull();
      const untouched = await db
        .selectFrom('domains')
        .where('id', '=', other.id)
        .select('notes')
        .executeTakeFirstOrThrow();
      expect(untouched.notes).toBeNull();
    });
  });
});

function byType(
  left: { notification_type: string },
  right: { notification_type: string },
) {
  return left.notification_type.localeCompare(right.notification_type);
}

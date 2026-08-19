import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createRepos, type Repos } from '~/server/db/repos';
import type { SaveDomainInput } from '~/server/db/repos/domains';
import type { Database } from '~/server/db/schema';
import {
  BACKENDS,
  SELF_HOST_USER,
  clearData,
  createMigratedDb,
} from '../../helpers/backends';

const OTHER_USER = 'b0000000-bbbb-42b0-b0b0-00b000000b69';

function domainInput(name: string, overrides: Partial<SaveDomainInput> = {}) {
  return {
    domain: { domain_name: name, registrar: { name: 'Reg One', url: 'https://reg.one' } },
    tags: ['production'],
    ipAddresses: [{ ipAddress: '1.1.1.1', isIpv6: false }],
    dns: { mxRecords: ['mx.test'], nameServers: ['ns.test'] },
    ssl: { issuer: 'Test CA' },
    host: { ip: '5.5.5.5', isp: 'Test ISP' },
    statuses: ['clientHold'],
    links: [{ link_name: 'Docs', link_url: 'https://docs.test' }],
    subdomains: [{ name: 'www' }],
    ...overrides,
  } satisfies SaveDomainInput;
}

describe.each(BACKENDS)('repositories (%s)', (backend) => {
  let db: Kysely<Database>;
  let repo: Repos;

  beforeAll(async () => {
    db = await createMigratedDb(backend, 'dl_test_repo_queries');
    repo = createRepos(db, backend);
  });

  afterAll(() => db?.destroy());

  beforeEach(() => clearData(db));

  describe('tags', () => {
    it('creates, renames and deletes a tag', async () => {
      const created = await repo.tags.create({ name: 'staging', color: 'blue' });
      expect(created.name).toBe('staging');

      const renamed = await repo.tags.update(created.id, {
        name: 'archived',
        color: 'grey',
      });
      expect(renamed?.name).toBe('archived');
      expect(renamed?.color).toBe('grey');

      expect(await repo.tags.remove(created.id)).toBe(true);
      expect(await repo.tags.list()).toEqual([]);
    });

    it('counts the domains carrying each tag', async () => {
      await repo.domains.save(domainInput('one.com'));
      await repo.domains.save(domainInput('two.com'));
      await repo.tags.create({ name: 'unused' });

      expect(await repo.tags.domainCounts()).toEqual({ production: 2, unused: 0 });
    });

    it('sets exactly the domains a tag applies to', async () => {
      const first = await repo.domains.save(domainInput('first.com'));
      const second = await repo.domains.save(domainInput('second.com'));
      const tag = await repo.tags.getByName('production');

      await repo.tags.setDomainsForTag(tag!.id, [second!.id]);

      const { selected } = await repo.tags.domainsForTag(tag!.id);
      expect(selected.map((domain) => domain.domain_name)).toEqual(['second.com']);
      expect((await repo.domains.getById(first!.id))?.tags).toEqual([]);
    });

    it('will not touch another user tags', async () => {
      const theirs = await db
        .insertInto('tags')
        .values({ name: 'theirs', user_id: OTHER_USER })
        .returning('id')
        .executeTakeFirstOrThrow();

      expect(await repo.tags.remove(theirs.id)).toBe(false);
      expect(await repo.tags.update(theirs.id, { name: 'hijacked' })).toBeNull();
      expect(await repo.tags.list()).toEqual([]);
    });
  });

  describe('notifications', () => {
    it('lists notifications newest first with a total', async () => {
      const domain = await repo.domains.save(domainInput('notify.com'));
      await repo.notifications.add(domain!.id, 'ssl', 'Certificate renewed');
      await repo.notifications.add(domain!.id, 'expiry', 'Expiring soon');

      const { notifications, total } = await repo.notifications.list();
      expect(total).toBe(2);
      expect(notifications[0].domain_name).toBe('notify.com');
      expect(notifications.map((entry) => entry.change_type).sort()).toEqual([
        'expiry',
        'ssl',
      ]);
      expect(notifications[0].read).toBe(false);
    });

    it('tracks read status', async () => {
      const domain = await repo.domains.save(domainInput('read.com'));
      await repo.notifications.add(domain!.id, 'ssl', 'One');
      await repo.notifications.add(domain!.id, 'ssl', 'Two');
      expect(await repo.notifications.unreadCount()).toBe(2);

      const { notifications } = await repo.notifications.list();
      expect(await repo.notifications.markRead(notifications[0].id, true)).toBe(true);
      expect(await repo.notifications.unreadCount()).toBe(1);

      expect(await repo.notifications.markAllRead()).toBe(2);
      expect(await repo.notifications.unreadCount()).toBe(0);
    });

    it('round-trips notification channels as json', async () => {
      expect(await repo.notifications.channels()).toBeNull();

      await repo.notifications.setChannels({
        email: { enabled: true, address: 'a@b.c' },
      });
      expect(await repo.notifications.channels()).toEqual({
        email: { enabled: true, address: 'a@b.c' },
      });

      await repo.notifications.setChannels({ email: { enabled: false } });
      expect(await repo.notifications.channels()).toEqual({ email: { enabled: false } });
    });

    it('upserts preferences and ignores domains the user does not own', async () => {
      const domain = await repo.domains.save(domainInput('prefs.com'));
      const theirs = await db
        .insertInto('domains')
        .values({ user_id: OTHER_USER, domain_name: 'theirs.com' })
        .returning('id')
        .executeTakeFirstOrThrow();

      await repo.notifications.setPreferences([
        { domain_id: domain!.id, notification_type: 'expiry', is_enabled: true },
        { domain_id: theirs.id, notification_type: 'expiry', is_enabled: true },
      ]);

      const prefs = await repo.notifications.preferences();
      expect(prefs).toEqual([
        { domain_id: domain!.id, notification_type: 'expiry', is_enabled: true },
      ]);

      await repo.notifications.setPreferences([
        { domain_id: domain!.id, notification_type: 'expiry', is_enabled: false },
      ]);
      expect((await repo.notifications.preferences())[0].is_enabled).toBe(false);
    });
  });

  describe('assets', () => {
    it('groups ip addresses by the domains using them', async () => {
      await repo.domains.save(domainInput('a.com'));
      await repo.domains.save(domainInput('b.com'));

      expect(await repo.assets.ipAddresses(false)).toEqual([
        { ip_address: '1.1.1.1', domains: expect.arrayContaining(['a.com', 'b.com']) },
      ]);
      expect(await repo.assets.ipAddresses(true)).toEqual([]);
    });

    it('groups dns records by value', async () => {
      await repo.domains.save(domainInput('dns.com'));
      expect(await repo.assets.dnsRecords('MX')).toEqual([
        { record_value: 'mx.test', domains: ['dns.com'] },
      ]);
      expect(await repo.assets.dnsRecords('TXT')).toEqual([]);
    });

    it('lists hosts with their domains and counts', async () => {
      await repo.domains.save(domainInput('host-a.com'));
      await repo.domains.save(domainInput('host-b.com'));

      const hosts = await repo.assets.hosts();
      expect(hosts).toHaveLength(1);
      expect(hosts[0].ip).toBe('5.5.5.5');
      expect(hosts[0].domains.sort()).toEqual(['host-a.com', 'host-b.com']);
      expect(await repo.assets.hostDomainCounts()).toEqual({ '5.5.5.5': 2 });
      expect(await repo.assets.domainsByHost('5.5.5.5')).toEqual([
        'host-a.com',
        'host-b.com',
      ]);
    });

    it('lists registrars with their domains', async () => {
      await repo.domains.save(domainInput('reg.com'));
      expect(await repo.assets.registrars()).toEqual([
        {
          id: expect.any(String),
          name: 'Reg One',
          url: 'https://reg.one',
          domains: ['reg.com'],
        },
      ]);
      expect(await repo.assets.registrarDomainCounts()).toEqual({ 'Reg One': 1 });
      expect(await repo.assets.domainsByRegistrar('Reg One')).toEqual(['reg.com']);
    });

    it('counts domains per ssl issuer', async () => {
      await repo.domains.save(domainInput('ssl-a.com'));
      await repo.domains.save(domainInput('ssl-b.com'));

      expect(await repo.assets.sslIssuers()).toEqual([
        { issuer: 'Test CA', domain_count: 2 },
      ]);
      expect(await repo.assets.domainsBySslIssuer('Test CA')).toEqual([
        'ssl-a.com',
        'ssl-b.com',
      ]);
    });

    it('reads and writes costings', async () => {
      const domain = await repo.domains.save(domainInput('valued.com'));

      const before = await repo.assets.costings();
      expect(before).toEqual([
        {
          domain_id: domain!.id,
          domain_name: 'valued.com',
          expiry_date: null,
          registrar: 'Reg One',
          purchase_price: 0,
          current_value: 0,
          renewal_cost: 0,
          auto_renew: false,
        },
      ]);

      await repo.assets.setCostings([
        {
          domain_id: domain!.id,
          purchase_price: 9.99,
          current_value: 40,
          renewal_cost: 11,
          auto_renew: true,
        },
      ]);

      const [after] = await repo.assets.costings();
      expect(after.purchase_price).toBe(9.99);
      expect(after.current_value).toBe(40);
      expect(after.auto_renew).toBe(true);
    });

    it('updates costings in place rather than duplicating them', async () => {
      const domain = await repo.domains.save(domainInput('once.com'));
      await repo.assets.setCostings([{ domain_id: domain!.id, current_value: 1 }]);
      await repo.assets.setCostings([{ domain_id: domain!.id, current_value: 2 }]);

      const rows = await db.selectFrom('domain_costings').selectAll().execute();
      expect(rows).toHaveLength(1);
      expect((await repo.assets.costings())[0].current_value).toBe(2);
    });
  });

  describe('links', () => {
    it('adds one link across several domains and groups them on read', async () => {
      const first = await repo.domains.save(domainInput('link-a.com', { links: [] }));
      const second = await repo.domains.save(domainInput('link-b.com', { links: [] }));

      const added = await repo.links.addToDomains(
        { link_name: 'Panel', link_url: 'https://panel.test' },
        [first!.id, second!.id],
      );
      expect(added).toBe(2);

      const links = await repo.links.list();
      expect(links).toHaveLength(1);
      expect(links[0].domains.map((domain) => domain.domain_name).sort()).toEqual([
        'link-a.com',
        'link-b.com',
      ]);
    });

    it('repoints a link at a different set of domains', async () => {
      const first = await repo.domains.save(domainInput('move-a.com'));
      const second = await repo.domains.save(domainInput('move-b.com', { links: [] }));

      await repo.links.updateAcrossDomains(
        { link_name: 'Docs', link_url: 'https://docs.test' },
        { link_name: 'Docs', link_url: 'https://docs.test', link_description: 'Moved' },
        [second!.id],
      );

      expect(await repo.links.forDomain(first!.id)).toEqual([]);
      const moved = await repo.links.forDomain(second!.id);
      expect(moved[0].link_description).toBe('Moved');
    });

    it('deletes a link everywhere it appears', async () => {
      await repo.domains.save(domainInput('del-a.com'));
      await repo.domains.save(domainInput('del-b.com'));

      expect(
        await repo.links.remove({ link_name: 'Docs', link_url: 'https://docs.test' }),
      ).toBe(2);
      expect(await repo.links.list()).toEqual([]);
    });
  });

  describe('history', () => {
    it('records a change against the domain owner', async () => {
      const domain = await repo.domains.save(domainInput('hist.com'));

      expect(
        await repo.history.record(domain!.id, {
          change: 'IP changed',
          change_type: 'updated',
          old_value: '1.1.1.1',
          new_value: '2.2.2.2',
        }),
      ).toBe(true);

      const [entry] = await repo.history.list();
      expect(entry.domain_name).toBe('hist.com');
      expect(entry.change).toBe('IP changed');
      const stored = await db.selectFrom('domain_updates').selectAll().execute();
      expect(stored[0].user_id).toBe(SELF_HOST_USER);
    });

    it('ignores a change for an unknown domain', async () => {
      expect(
        await repo.history.record('00000000-0000-4000-8000-000000000000', {
          change: 'x',
          change_type: 'updated',
        }),
      ).toBe(false);
    });

    it('buckets changes by day and counts them', async () => {
      const domain = await repo.domains.save(domainInput('bucket.com'));
      await repo.history.record(domain!.id, { change: 'a', change_type: 'added' });
      await repo.history.record(domain!.id, { change: 'b', change_type: 'removed' });
      await repo.history.record(domain!.id, { change: 'c', change_type: 'updated' });

      const [day] = await repo.history.changesByDay(7);
      expect(day).toEqual({
        date: new Date().toISOString().slice(0, 10),
        added: 1,
        removed: 1,
        updated: 1,
      });
      expect(await repo.history.totalCount()).toBe(3);
      expect(await repo.history.totalCount('bucket.com')).toBe(3);
      expect(await repo.history.totalCount('other.com')).toBe(0);
    });
  });

  describe('uptime', () => {
    it('returns checks inside the timeframe, oldest first', async () => {
      const domain = await repo.domains.save(domainInput('up.com'));
      const now = Date.now();
      await repo.uptime.record(domain!.id, {
        is_up: true,
        response_code: 200,
        response_time_ms: 120,
        dns_lookup_time_ms: 10,
        ssl_handshake_time_ms: 20,
        checked_at: new Date(now - 3_600_000).toISOString(),
      });
      await repo.uptime.record(domain!.id, {
        is_up: false,
        response_code: 500,
        response_time_ms: null,
        dns_lookup_time_ms: null,
        ssl_handshake_time_ms: null,
        checked_at: new Date(now - 40 * 86_400_000).toISOString(),
      });

      const day = await repo.uptime.history(domain!.id, 'day');
      expect(day).toHaveLength(1);
      expect(day[0].is_up).toBe(true);
      expect(day[0].response_time_ms).toBe(120);

      expect(await repo.uptime.history(domain!.id, 'year')).toHaveLength(2);
    });

    it('averages response times per day', async () => {
      const domain = await repo.domains.save(domainInput('daily.com'));
      const today = new Date().toISOString().slice(0, 10);
      for (const responseTime of [100, 200]) {
        await repo.uptime.record(domain!.id, {
          is_up: true,
          response_code: 200,
          response_time_ms: responseTime,
          dns_lookup_time_ms: null,
          ssl_handshake_time_ms: null,
        });
      }

      const daily = await repo.uptime.daily(domain!.id, 7);
      expect(daily).toEqual([{ day: today, avg_response_time_ms: 150 }]);
    });

    it('reports the latest check per domain', async () => {
      const first = await repo.domains.save(domainInput('latest-a.com'));
      const second = await repo.domains.save(domainInput('latest-b.com'));
      await repo.uptime.record(first!.id, {
        is_up: false,
        response_code: 500,
        response_time_ms: null,
        dns_lookup_time_ms: null,
        ssl_handshake_time_ms: null,
        checked_at: new Date(Date.now() - 60_000).toISOString(),
      });
      await repo.uptime.record(first!.id, {
        is_up: true,
        response_code: 200,
        response_time_ms: 50,
        dns_lookup_time_ms: null,
        ssl_handshake_time_ms: null,
      });

      const latest = await repo.uptime.latestFor([first!.id, second!.id]);
      expect(latest[first!.id]?.is_up).toBe(true);
      expect(latest[first!.id]?.response_code).toBe(200);
      expect(latest[second!.id]).toBeNull();
    });

    it('prunes checks past the retention window', async () => {
      const domain = await repo.domains.save(domainInput('prune.com'));
      await repo.uptime.record(domain!.id, {
        is_up: true,
        response_code: 200,
        response_time_ms: 10,
        dns_lookup_time_ms: null,
        ssl_handshake_time_ms: null,
        checked_at: new Date(Date.now() - 100 * 86_400_000).toISOString(),
      });
      await repo.uptime.record(domain!.id, {
        is_up: true,
        response_code: 200,
        response_time_ms: 10,
        dns_lookup_time_ms: null,
        ssl_handshake_time_ms: null,
      });

      expect(await repo.uptime.prune(90)).toBe(1);
      expect(await repo.uptime.history(domain!.id, 'year')).toHaveLength(1);
    });
  });

  describe('admin', () => {
    it('counts rows in every table', async () => {
      await repo.domains.save(domainInput('counted.com'));

      const checks = await repo.admin.checkTables();
      expect(checks.every((check) => check.success)).toBe(true);
      expect(checks.find((check) => check.table === 'domains')?.count).toBe(1);
      expect(checks.find((check) => check.table === 'billing')?.count).toBe(0);
    });

    it('deletes this user data and leaves other users alone', async () => {
      await repo.domains.save(domainInput('mine.com'));
      await db
        .insertInto('domains')
        .values({ user_id: OTHER_USER, domain_name: 'theirs.com' })
        .execute();

      await repo.admin.deleteAllData();

      expect(await repo.domains.list()).toEqual([]);
      expect(await db.selectFrom('domains').selectAll().execute()).toHaveLength(1);
      expect(await db.selectFrom('tags').selectAll().execute()).toEqual([]);
    });

    it('deletes only the tables it is asked to', async () => {
      await repo.domains.save(domainInput('partial.com'));

      await repo.admin.deleteAllData(['tags']);

      expect(await db.selectFrom('tags').selectAll().execute()).toEqual([]);
      expect(await repo.domains.count()).toBe(1);
    });
  });
});

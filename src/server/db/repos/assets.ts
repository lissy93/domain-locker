import type { Kysely } from 'kysely';
import type { Database } from '../schema';
import { currentUserId, toBoolean, toNumber } from './helpers';

/** Groups the flat rows the queries return into one entry per asset */
function collect<T, R>(
  rows: T[],
  keyOf: (row: T) => string,
  build: (row: T) => R,
  domainOf: (row: T) => string,
): (R & { domains: string[] })[] {
  const byKey = new Map<string, R & { domains: string[] }>();
  for (const row of rows) {
    const key = keyOf(row);
    let entry = byKey.get(key);
    if (!entry) {
      entry = { ...build(row), domains: [] };
      byKey.set(key, entry);
    }
    entry.domains.push(domainOf(row));
  }
  return [...byKey.values()];
}

export function assetsRepo(db: Kysely<Database>) {
  return {
    /** IPv4 or IPv6 addresses, each with the domains that resolve to it */
    async ipAddresses(isIpv6: boolean, userId = currentUserId()) {
      const rows = await db
        .selectFrom('ip_addresses')
        .innerJoin('domains', 'domains.id', 'ip_addresses.domain_id')
        .where('domains.user_id', '=', userId)
        .where('ip_addresses.is_ipv6', '=', isIpv6)
        .select(['ip_addresses.ip_address', 'domains.domain_name'])
        .orderBy('ip_addresses.ip_address')
        .execute();
      return collect(
        rows,
        (row) => row.ip_address,
        (row) => ({ ip_address: row.ip_address }),
        (row) => row.domain_name,
      );
    },

    async dnsRecords(recordType: string, userId = currentUserId()) {
      const rows = await db
        .selectFrom('dns_records')
        .innerJoin('domains', 'domains.id', 'dns_records.domain_id')
        .where('domains.user_id', '=', userId)
        .where('dns_records.record_type', '=', recordType)
        .select(['dns_records.record_value', 'domains.domain_name'])
        .orderBy('dns_records.record_value')
        .execute();
      return collect(
        rows,
        (row) => row.record_value,
        (row) => ({ record_value: row.record_value }),
        (row) => row.domain_name,
      );
    },

    async hosts(userId = currentUserId()) {
      const rows = await db
        .selectFrom('hosts')
        .leftJoin('domain_hosts', 'domain_hosts.host_id', 'hosts.id')
        .leftJoin('domains', 'domains.id', 'domain_hosts.domain_id')
        .where('hosts.user_id', '=', userId)
        .select([
          'hosts.id',
          'hosts.ip',
          'hosts.lat',
          'hosts.lon',
          'hosts.isp',
          'hosts.org',
          'hosts.as_number',
          'hosts.city',
          'hosts.region',
          'hosts.country',
          'domains.domain_name',
        ])
        .orderBy('hosts.ip')
        .execute();

      const hosts = new Map<
        string,
        {
          id: string;
          ip: string;
          lat: number | null;
          lon: number | null;
          isp: string | null;
          org: string | null;
          as_number: string | null;
          city: string | null;
          region: string | null;
          country: string | null;
          domains: string[];
        }
      >();
      for (const row of rows) {
        let host = hosts.get(row.id);
        if (!host) {
          host = {
            id: row.id,
            ip: row.ip,
            lat: toNumber(row.lat),
            lon: toNumber(row.lon),
            isp: row.isp,
            org: row.org,
            as_number: row.as_number,
            city: row.city,
            region: row.region,
            country: row.country,
            domains: [],
          };
          hosts.set(row.id, host);
        }
        if (row.domain_name) host.domains.push(row.domain_name);
      }
      return [...hosts.values()];
    },

    async domainsByHost(ip: string, userId = currentUserId()): Promise<string[]> {
      const rows = await db
        .selectFrom('domain_hosts')
        .innerJoin('hosts', 'hosts.id', 'domain_hosts.host_id')
        .innerJoin('domains', 'domains.id', 'domain_hosts.domain_id')
        .where('domains.user_id', '=', userId)
        .where('hosts.ip', '=', ip)
        .select('domains.domain_name')
        .orderBy('domains.domain_name')
        .execute();
      return rows.map((row) => row.domain_name);
    },

    async hostDomainCounts(userId = currentUserId()): Promise<Record<string, number>> {
      const rows = await db
        .selectFrom('hosts')
        .leftJoin('domain_hosts', 'domain_hosts.host_id', 'hosts.id')
        .where('hosts.user_id', '=', userId)
        .groupBy('hosts.ip')
        .select((eb) => ['hosts.ip', eb.fn.count('domain_hosts.domain_id').as('count')])
        .execute();
      return Object.fromEntries(rows.map((row) => [row.ip, toNumber(row.count) ?? 0]));
    },

    async registrars(userId = currentUserId()) {
      const rows = await db
        .selectFrom('registrars')
        .leftJoin('domains', 'domains.registrar_id', 'registrars.id')
        .where('registrars.user_id', '=', userId)
        .select([
          'registrars.id',
          'registrars.name',
          'registrars.url',
          'domains.domain_name',
        ])
        .orderBy('registrars.name')
        .execute();
      return collect(
        rows.filter((row) => row.domain_name !== null),
        (row) => row.id,
        (row) => ({ id: row.id, name: row.name, url: row.url }),
        (row) => row.domain_name as string,
      );
    },

    async domainsByRegistrar(name: string, userId = currentUserId()): Promise<string[]> {
      const rows = await db
        .selectFrom('domains')
        .innerJoin('registrars', 'registrars.id', 'domains.registrar_id')
        .where('domains.user_id', '=', userId)
        .where('registrars.name', '=', name)
        .select('domains.domain_name')
        .orderBy('domains.domain_name')
        .execute();
      return rows.map((row) => row.domain_name);
    },

    async registrarDomainCounts(
      userId = currentUserId(),
    ): Promise<Record<string, number>> {
      const rows = await db
        .selectFrom('registrars')
        .leftJoin('domains', 'domains.registrar_id', 'registrars.id')
        .where('registrars.user_id', '=', userId)
        .groupBy('registrars.name')
        .select((eb) => ['registrars.name', eb.fn.count('domains.id').as('count')])
        .execute();
      return Object.fromEntries(rows.map((row) => [row.name, toNumber(row.count) ?? 0]));
    },

    async sslIssuers(userId = currentUserId()) {
      const rows = await db
        .selectFrom('ssl_certificates')
        .innerJoin('domains', 'domains.id', 'ssl_certificates.domain_id')
        .where('domains.user_id', '=', userId)
        .where('ssl_certificates.issuer', 'is not', null)
        .groupBy('ssl_certificates.issuer')
        .select((eb) => [
          'ssl_certificates.issuer',
          eb.fn.count('domains.id').as('domain_count'),
        ])
        .orderBy('ssl_certificates.issuer')
        .execute();
      return rows.map((row) => ({
        issuer: row.issuer as string,
        domain_count: toNumber(row.domain_count) ?? 0,
      }));
    },

    async domainsBySslIssuer(
      issuer: string,
      userId = currentUserId(),
    ): Promise<string[]> {
      const rows = await db
        .selectFrom('ssl_certificates')
        .innerJoin('domains', 'domains.id', 'ssl_certificates.domain_id')
        .where('domains.user_id', '=', userId)
        .where('ssl_certificates.issuer', '=', issuer)
        .select('domains.domain_name')
        .orderBy('domains.domain_name')
        .execute();
      return rows.map((row) => row.domain_name);
    },

    async subdomains(userId = currentUserId()) {
      const rows = await db
        .selectFrom('sub_domains')
        .innerJoin('domains', 'domains.id', 'sub_domains.domain_id')
        .where('domains.user_id', '=', userId)
        .select([
          'sub_domains.id',
          'sub_domains.name',
          'sub_domains.sd_info',
          'domains.domain_name',
          'domains.id as domain_id',
        ])
        .orderBy(['domains.domain_name', 'sub_domains.name'])
        .execute();
      return rows;
    },

    async subdomainsForDomain(domainName: string, userId = currentUserId()) {
      const rows = await db
        .selectFrom('sub_domains')
        .innerJoin('domains', 'domains.id', 'sub_domains.domain_id')
        .where('domains.user_id', '=', userId)
        .where('domains.domain_name', '=', domainName)
        .select(['sub_domains.id', 'sub_domains.name', 'sub_domains.sd_info'])
        .orderBy('sub_domains.name')
        .execute();
      return rows;
    },

    async links(userId = currentUserId()) {
      const rows = await db
        .selectFrom('domain_links')
        .innerJoin('domains', 'domains.id', 'domain_links.domain_id')
        .where('domains.user_id', '=', userId)
        .select([
          'domain_links.id',
          'domain_links.link_name',
          'domain_links.link_url',
          'domain_links.link_description',
          'domains.domain_name',
          'domains.id as domain_id',
        ])
        .orderBy('domain_links.link_name')
        .execute();
      return rows;
    },

    async statuses(userId = currentUserId()) {
      const rows = await db
        .selectFrom('domain_statuses')
        .innerJoin('domains', 'domains.id', 'domain_statuses.domain_id')
        .where('domains.user_id', '=', userId)
        .select(['domain_statuses.status_code', 'domains.domain_name'])
        .orderBy('domain_statuses.status_code')
        .execute();
      return collect(
        rows,
        (row) => row.status_code,
        (row) => ({ status_code: row.status_code }),
        (row) => row.domain_name,
      );
    },

    /** Costings for every domain, as the valuations page lists them */
    async costings(userId = currentUserId()) {
      const rows = await db
        .selectFrom('domains')
        .leftJoin('domain_costings', 'domain_costings.domain_id', 'domains.id')
        .leftJoin('registrars', 'registrars.id', 'domains.registrar_id')
        .where('domains.user_id', '=', userId)
        .select([
          'domains.id as domain_id',
          'domains.domain_name',
          'domains.expiry_date',
          'registrars.name as registrar',
          'domain_costings.purchase_price',
          'domain_costings.current_value',
          'domain_costings.renewal_cost',
          'domain_costings.auto_renew',
        ])
        .orderBy('domains.domain_name')
        .execute();

      return rows.map((row) => ({
        domain_id: row.domain_id,
        domain_name: row.domain_name,
        expiry_date: row.expiry_date,
        registrar: row.registrar,
        purchase_price: toNumber(row.purchase_price) ?? 0,
        current_value: toNumber(row.current_value) ?? 0,
        renewal_cost: toNumber(row.renewal_cost) ?? 0,
        auto_renew: toBoolean(row.auto_renew),
      }));
    },

    /** Upserts costings for the caller's domains, one row per domain */
    async setCostings(
      updates: {
        domain_id: string;
        purchase_price?: number | null;
        current_value?: number | null;
        renewal_cost?: number | null;
        auto_renew?: boolean;
      }[],
      userId = currentUserId(),
    ): Promise<void> {
      if (!updates.length) return;
      const domainIds = updates.map((update) => update.domain_id);

      await db.transaction().execute(async (trx) => {
        const owned = new Set(
          (
            await trx
              .selectFrom('domains')
              .where('user_id', '=', userId)
              .where('id', 'in', domainIds)
              .select('id')
              .execute()
          ).map((domain) => domain.id),
        );
        const allowed = updates.filter((update) => owned.has(update.domain_id));
        if (!allowed.length) return;

        await trx
          .insertInto('domain_costings')
          .values(
            allowed.map((update) => ({
              domain_id: update.domain_id,
              purchase_price: update.purchase_price ?? 0,
              current_value: update.current_value ?? 0,
              renewal_cost: update.renewal_cost ?? 0,
              auto_renew: update.auto_renew ?? false,
            })),
          )
          .onConflict((conflict) =>
            conflict.column('domain_id').doUpdateSet((eb) => ({
              purchase_price: eb.ref('excluded.purchase_price'),
              current_value: eb.ref('excluded.current_value'),
              renewal_cost: eb.ref('excluded.renewal_cost'),
              auto_renew: eb.ref('excluded.auto_renew'),
            })),
          )
          .execute();
      });
    },
  };
}

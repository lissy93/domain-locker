import { sql, type Kysely } from 'kysely';
import type { Database } from '../schema';
import {
  currentUserId,
  groupBy,
  indexBy,
  omit,
  toBoolean,
  toJsonString,
  toNumber,
} from './helpers';
import { insertDomain, updateDomain, type SaveDomainInput } from './domain-write';
import type { AssetType } from '../../../types/common';

export type { SaveDomainInput, AssetType };

/** Shape the client consumes, matching the legacy formatDomainData output */
export interface DomainRecord {
  id: string;
  user_id: string | null;
  domain_name: string;
  expiry_date: string | null;
  registration_date: string | null;
  updated_date: string | null;
  notes: string | null;
  created_at: string;
  registrar_id: string | null;
  registrar: { name: string; url: string | null } | null;
  whois: Record<string, string | null> | null;
  domain_costings: {
    purchase_price: number | null;
    current_value: number | null;
    renewal_cost: number | null;
    auto_renew: boolean;
  } | null;
  ip_addresses: { ip_address: string; is_ipv6: boolean }[];
  ssl: Record<string, unknown> | null;
  host: Record<string, unknown> | null;
  tags: string[];
  notification_preferences: { notification_type: string; is_enabled: boolean }[];
  dns: { mxRecords: string[]; txtRecords: string[]; nameServers: string[] };
  statusCodes: string[];
  sub_domains: { name: string; sd_info: string | null }[];
  domain_links: {
    link_name: string;
    link_url: string;
    link_description: string | null;
  }[];
}

const WHOIS_FIELDS = [
  'name',
  'organization',
  'country',
  'street',
  'city',
  'state',
  'postal_code',
] as const;

export function domainsRepo(db: Kysely<Database>) {
  /** Base row plus its one-to-one relations, before collections are stitched in */
  function baseQuery(userId: string) {
    return db
      .selectFrom('domains')
      .leftJoin('registrars', 'registrars.id', 'domains.registrar_id')
      .leftJoin('domain_costings', 'domain_costings.domain_id', 'domains.id')
      .where('domains.user_id', '=', userId)
      .select([
        'domains.id',
        'domains.user_id',
        'domains.domain_name',
        'domains.expiry_date',
        'domains.registration_date',
        'domains.updated_date',
        'domains.notes',
        'domains.created_at',
        'domains.registrar_id',
        'registrars.name as registrar_name',
        'registrars.url as registrar_url',
        'domain_costings.purchase_price',
        'domain_costings.current_value',
        'domain_costings.renewal_cost',
        'domain_costings.auto_renew',
      ]);
  }

  type BaseRow = Awaited<ReturnType<ReturnType<typeof baseQuery>['execute']>>[number];

  /** Fetches every collection for the given domains in one round trip each */
  async function withRelations(rows: BaseRow[]): Promise<DomainRecord[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);

    const [ips, ssl, whois, tags, prefs, hosts, dns, statuses, subdomains, links] =
      await Promise.all([
        db
          .selectFrom('ip_addresses')
          .where('domain_id', 'in', ids)
          .select(['domain_id', 'ip_address', 'is_ipv6'])
          .execute(),
        db
          .selectFrom('ssl_certificates')
          .where('domain_id', 'in', ids)
          .selectAll()
          .execute(),
        db
          .selectFrom('whois_info')
          .where('domain_id', 'in', ids)
          .select(['domain_id', ...WHOIS_FIELDS])
          .execute(),
        db
          .selectFrom('domain_tags')
          .innerJoin('tags', 'tags.id', 'domain_tags.tag_id')
          .where('domain_tags.domain_id', 'in', ids)
          .select(['domain_tags.domain_id', 'tags.name'])
          .execute(),
        db
          .selectFrom('notification_preferences')
          .where('domain_id', 'in', ids)
          .select(['domain_id', 'notification_type', 'is_enabled'])
          .execute(),
        db
          .selectFrom('domain_hosts')
          .innerJoin('hosts', 'hosts.id', 'domain_hosts.host_id')
          .where('domain_hosts.domain_id', 'in', ids)
          .select([
            'domain_hosts.domain_id',
            'hosts.ip',
            'hosts.lat',
            'hosts.lon',
            'hosts.isp',
            'hosts.org',
            'hosts.as_number',
            'hosts.city',
            'hosts.region',
            'hosts.country',
          ])
          .execute(),
        db
          .selectFrom('dns_records')
          .where('domain_id', 'in', ids)
          .select(['domain_id', 'record_type', 'record_value'])
          .execute(),
        db
          .selectFrom('domain_statuses')
          .where('domain_id', 'in', ids)
          .select(['domain_id', 'status_code'])
          .execute(),
        db
          .selectFrom('sub_domains')
          .where('domain_id', 'in', ids)
          .select(['domain_id', 'name', 'sd_info'])
          .execute(),
        db
          .selectFrom('domain_links')
          .where('domain_id', 'in', ids)
          .select(['domain_id', 'link_name', 'link_url', 'link_description'])
          .execute(),
      ]);

    const byDomain = {
      ips: groupBy(ips, 'domain_id'),
      ssl: indexBy(ssl, 'domain_id'),
      whois: indexBy(whois, 'domain_id'),
      tags: groupBy(tags, 'domain_id'),
      prefs: groupBy(prefs, 'domain_id'),
      hosts: groupBy(hosts, 'domain_id'),
      dns: groupBy(dns, 'domain_id'),
      statuses: groupBy(statuses, 'domain_id'),
      subdomains: groupBy(subdomains, 'domain_id'),
      links: groupBy(links, 'domain_id'),
    };

    return rows.map((row) => {
      const records = byDomain.dns.get(row.id) ?? [];
      const recordsOfType = (type: string) =>
        records
          .filter((record) => record.record_type === type)
          .map((record) => record.record_value);
      const certificate = byDomain.ssl.get(row.id);
      const [host] = byDomain.hosts.get(row.id) ?? [];

      return {
        id: row.id,
        user_id: row.user_id,
        domain_name: row.domain_name,
        expiry_date: row.expiry_date,
        registration_date: row.registration_date,
        updated_date: row.updated_date,
        notes: row.notes,
        created_at: row.created_at,
        registrar_id: row.registrar_id,
        registrar: row.registrar_name
          ? { name: row.registrar_name, url: row.registrar_url }
          : null,
        whois: whoisOf(byDomain.whois.get(row.id)),
        domain_costings: costingsOf(row),
        ip_addresses: (byDomain.ips.get(row.id) ?? []).map((ip) => ({
          ip_address: ip.ip_address,
          is_ipv6: toBoolean(ip.is_ipv6),
        })),
        ssl: certificate ? certificateOf(certificate) : null,
        host: host ? omit(host, ['domain_id']) : null,
        tags: (byDomain.tags.get(row.id) ?? []).map((tag) => tag.name),
        notification_preferences: (byDomain.prefs.get(row.id) ?? []).map((pref) => ({
          notification_type: pref.notification_type,
          is_enabled: toBoolean(pref.is_enabled),
        })),
        dns: {
          mxRecords: recordsOfType('MX'),
          txtRecords: recordsOfType('TXT'),
          nameServers: recordsOfType('NS'),
        },
        statusCodes: (byDomain.statuses.get(row.id) ?? []).map(
          (status) => status.status_code,
        ),
        sub_domains: (byDomain.subdomains.get(row.id) ?? []).map((sub) => ({
          name: sub.name,
          sd_info: toJsonString(sub.sd_info),
        })),
        domain_links: (byDomain.links.get(row.id) ?? []).map((link) => ({
          link_name: link.link_name,
          link_url: link.link_url,
          link_description: link.link_description,
        })),
      } satisfies DomainRecord;
    });
  }

  return {
    /** Optionally narrowed to named domains, for export */
    async list(userId = currentUserId(), names?: string[]): Promise<DomainRecord[]> {
      const query = baseQuery(userId);
      const rows = await (names
        ? query.where(sql`lower(domains.domain_name)`, 'in', names).execute()
        : query.execute());
      return withRelations(rows);
    },

    /** Least recently refreshed first, so a capped updater run reaches every domain in turn */
    async listStalest(limit: number, userId = currentUserId()): Promise<DomainRecord[]> {
      // Picked before the joins, so a domain with duplicate rows takes one slot
      const stalest = db
        .selectFrom('domains')
        .where('user_id', '=', userId)
        .select('id')
        .orderBy('updated_at')
        .limit(limit);
      const rows = await baseQuery(userId)
        .where('domains.id', 'in', stalest)
        .orderBy('domains.updated_at')
        .execute();
      return withRelations(rows);
    },

    /** updated_at records the last refresh, which is what listStalest orders on */
    async markRefreshed(id: string, userId = currentUserId()): Promise<void> {
      await db
        .updateTable('domains')
        .set({ updated_at: new Date().toISOString() })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .execute();
    },

    async getByName(
      domainName: string,
      userId = currentUserId(),
    ): Promise<DomainRecord | null> {
      const rows = await baseQuery(userId)
        .where('domains.domain_name', '=', domainName)
        .execute();
      const [domain] = await withRelations(rows);
      return domain ?? null;
    },

    async getById(id: string, userId = currentUserId()): Promise<DomainRecord | null> {
      const rows = await baseQuery(userId).where('domains.id', '=', id).execute();
      const [domain] = await withRelations(rows);
      return domain ?? null;
    },

    async nameById(id: string): Promise<string | null> {
      const row = await db
        .selectFrom('domains')
        .where('id', '=', id)
        .select('domain_name')
        .executeTakeFirst();
      return row?.domain_name ?? null;
    },

    /** Id and name only, for the monitor job */
    async listForMonitoring(userId = currentUserId()) {
      return db
        .selectFrom('domains')
        .where('user_id', '=', userId)
        .select(['id', 'domain_name'])
        .orderBy('domain_name')
        .execute();
    },

    /** Domains that carry an expiry date, for the reminder job */
    async listExpiring(userId = currentUserId()) {
      return db
        .selectFrom('domains')
        .where('user_id', '=', userId)
        .where('expiry_date', 'is not', null)
        .select(['id', 'domain_name', 'expiry_date'])
        .orderBy('expiry_date')
        .$narrowType<{ expiry_date: string }>()
        .execute();
    },

    async listNames(userId = currentUserId()): Promise<string[]> {
      const rows = await db
        .selectFrom('domains')
        .where('user_id', '=', userId)
        .select('domain_name')
        .execute();
      return rows.map((row) => row.domain_name.toLowerCase());
    },

    async exists(domainName: string, userId = currentUserId()): Promise<boolean> {
      const row = await db
        .selectFrom('domains')
        .where('user_id', '=', userId)
        .where('domain_name', '=', domainName)
        .select('id')
        .executeTakeFirst();
      return Boolean(row);
    },

    async count(userId = currentUserId()): Promise<number> {
      const row = await db
        .selectFrom('domains')
        .where('user_id', '=', userId)
        .select(db.fn.countAll().as('total'))
        .executeTakeFirst();
      return toNumber(row?.total) ?? 0;
    },

    async expirations(
      userId = currentUserId(),
    ): Promise<{ domain: string; expiration: string | null }[]> {
      const rows = await db
        .selectFrom('domains')
        .where('user_id', '=', userId)
        .select(['domain_name', 'expiry_date'])
        .execute();
      return rows.map((row) => ({
        domain: row.domain_name,
        expiration: row.expiry_date,
      }));
    },

    async listByTag(tagName: string, userId = currentUserId()): Promise<DomainRecord[]> {
      const rows = await baseQuery(userId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('domain_tags')
              .innerJoin('tags', 'tags.id', 'domain_tags.tag_id')
              .whereRef('domain_tags.domain_id', '=', 'domains.id')
              .where('tags.name', '=', tagName)
              .select('tags.id'),
          ),
        )
        .execute();
      return withRelations(rows);
    },

    async listByStatus(
      statusCode: string,
      userId = currentUserId(),
    ): Promise<DomainRecord[]> {
      const rows = await baseQuery(userId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('domain_statuses')
              .whereRef('domain_statuses.domain_id', '=', 'domains.id')
              .where('domain_statuses.status_code', '=', statusCode)
              .select('domain_statuses.id'),
          ),
        )
        .execute();
      return withRelations(rows);
    },

    async listByHostIsp(isp: string, userId = currentUserId()): Promise<DomainRecord[]> {
      const rows = await baseQuery(userId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('domain_hosts')
              .innerJoin('hosts', 'hosts.id', 'domain_hosts.host_id')
              .whereRef('domain_hosts.domain_id', '=', 'domains.id')
              .where('hosts.isp', '=', isp)
              .select('hosts.id'),
          ),
        )
        .execute();
      return withRelations(rows);
    },

    async listByRegistrar(
      name: string,
      userId = currentUserId(),
    ): Promise<DomainRecord[]> {
      const rows = await baseQuery(userId).where('registrars.name', '=', name).execute();
      return withRelations(rows);
    },

    async listBySslIssuer(
      issuer: string,
      userId = currentUserId(),
    ): Promise<DomainRecord[]> {
      const rows = await baseQuery(userId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('ssl_certificates')
              .whereRef('ssl_certificates.domain_id', '=', 'domains.id')
              .where('ssl_certificates.issuer', '=', issuer)
              .select('ssl_certificates.id'),
          ),
        )
        .execute();
      return withRelations(rows);
    },

    /** Domain ids and names grouped by each requested EPP status code */
    async byEppCodes(
      statusCodes: string[],
      userId = currentUserId(),
    ): Promise<Record<string, { domainId: string; domainName: string }[]>> {
      const grouped = Object.fromEntries(statusCodes.map((code) => [code, []])) as Record<
        string,
        { domainId: string; domainName: string }[]
      >;
      if (!statusCodes.length) return grouped;

      const rows = await db
        .selectFrom('domain_statuses')
        .innerJoin('domains', 'domains.id', 'domain_statuses.domain_id')
        .where('domains.user_id', '=', userId)
        .where('domain_statuses.status_code', 'in', statusCodes)
        .select([
          'domain_statuses.status_code',
          'domains.id as domain_id',
          'domains.domain_name',
        ])
        .execute();

      for (const row of rows) {
        grouped[row.status_code]?.push({
          domainId: row.domain_id,
          domainName: row.domain_name,
        });
      }
      return grouped;
    },

    async statusesWithCounts(
      userId = currentUserId(),
    ): Promise<{ eppCode: string; domainCount: number }[]> {
      const rows = await db
        .selectFrom('domain_statuses')
        .innerJoin('domains', 'domains.id', 'domain_statuses.domain_id')
        .where('domains.user_id', '=', userId)
        .groupBy('domain_statuses.status_code')
        .select((eb) => [
          'domain_statuses.status_code',
          eb.fn.countAll().as('domain_count'),
        ])
        .execute();
      return rows.map((row) => ({
        eppCode: row.status_code,
        domainCount: toNumber(row.domain_count) ?? 0,
      }));
    },

    /** Number of rows in an asset table belonging to this user's domains */
    async assetCount(assetType: AssetType, userId = currentUserId()): Promise<number> {
      const source = ASSET_SOURCES[assetType];
      if (!source) throw new Error(`Unknown asset type: ${assetType}`);
      const table = sql.table(source.table);
      const query = source.viaDomain
        ? sql<{ total: number }>`SELECT count(*) AS total FROM ${table} a
             JOIN domains d ON d.id = a.domain_id WHERE d.user_id = ${userId}`
        : sql<{
            total: number;
          }>`SELECT count(*) AS total FROM ${table} WHERE user_id = ${userId}`;
      const { rows } = await query.execute(db);
      return toNumber(rows[0]?.total) ?? 0;
    },

    async save(
      input: SaveDomainInput,
      userId = currentUserId(),
    ): Promise<DomainRecord | null> {
      const id = await insertDomain(db, input, userId);
      return this.getById(id, userId);
    },

    async update(
      id: string,
      input: SaveDomainInput,
      userId = currentUserId(),
    ): Promise<DomainRecord | null> {
      const updated = await updateDomain(db, id, input, userId);
      return updated ? this.getById(id, userId) : null;
    },

    async remove(id: string, userId = currentUserId()): Promise<boolean> {
      const owned = await db
        .selectFrom('domains')
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .select(['id', 'registrar_id'])
        .executeTakeFirst();
      if (!owned) return false;

      await db.transaction().execute(async (trx) => {
        // Only what this domain referenced, so unused tags survive
        const tagIds = (
          await trx
            .selectFrom('domain_tags')
            .where('domain_id', '=', id)
            .select('tag_id')
            .execute()
        ).map((row) => row.tag_id);
        const hostIds = (
          await trx
            .selectFrom('domain_hosts')
            .where('domain_id', '=', id)
            .select('host_id')
            .execute()
        ).map((row) => row.host_id);

        // Child rows cascade, so only the tidy-up of shared records is explicit
        await trx.deleteFrom('domains').where('id', '=', id).execute();

        if (tagIds.length) {
          await trx
            .deleteFrom('tags')
            .where('user_id', '=', userId)
            .where('id', 'in', tagIds)
            .where((eb) =>
              eb.not(
                eb.exists(
                  eb
                    .selectFrom('domain_tags')
                    .whereRef('domain_tags.tag_id', '=', 'tags.id')
                    .select('domain_tags.tag_id'),
                ),
              ),
            )
            .execute();
        }

        if (hostIds.length) {
          await trx
            .deleteFrom('hosts')
            .where('user_id', '=', userId)
            .where('id', 'in', hostIds)
            .where((eb) =>
              eb.not(
                eb.exists(
                  eb
                    .selectFrom('domain_hosts')
                    .whereRef('domain_hosts.host_id', '=', 'hosts.id')
                    .select('domain_hosts.host_id'),
                ),
              ),
            )
            .execute();
        }

        if (owned.registrar_id) {
          await trx
            .deleteFrom('registrars')
            .where('user_id', '=', userId)
            .where('id', '=', owned.registrar_id)
            .where((eb) =>
              eb.not(
                eb.exists(
                  eb
                    .selectFrom('domains')
                    .whereRef('domains.registrar_id', '=', 'registrars.id')
                    .select('domains.id'),
                ),
              ),
            )
            .execute();
        }
      });
      return true;
    },
  };
}

/** Where each countable asset lives, and whether it is owned via its domain */
const ASSET_SOURCES: Record<AssetType, { table: string; viaDomain: boolean }> = {
  domains: { table: 'domains', viaDomain: false },
  registrars: { table: 'registrars', viaDomain: false },
  tags: { table: 'tags', viaDomain: false },
  hosts: { table: 'hosts', viaDomain: false },
  ip_addresses: { table: 'ip_addresses', viaDomain: true },
  ssl_certificates: { table: 'ssl_certificates', viaDomain: true },
  dns_records: { table: 'dns_records', viaDomain: true },
  links: { table: 'domain_links', viaDomain: true },
  subdomains: { table: 'sub_domains', viaDomain: true },
  domain_statuses: { table: 'domain_statuses', viaDomain: true },
};

function whoisOf(
  row?: Record<(typeof WHOIS_FIELDS)[number], string | null>,
): Record<string, string | null> | null {
  if (!row) return null;
  const whois = Object.fromEntries(WHOIS_FIELDS.map((f) => [f, row[f] ?? null]));
  return Object.values(whois).some(Boolean) ? whois : null;
}

function costingsOf(row: {
  purchase_price: number | null;
  current_value: number | null;
  renewal_cost: number | null;
  auto_renew: boolean | null;
}) {
  const hasCostings = [row.purchase_price, row.current_value, row.renewal_cost].some(
    (value) => value !== null,
  );
  if (!hasCostings && row.auto_renew === null) return null;
  return {
    purchase_price: toNumber(row.purchase_price),
    current_value: toNumber(row.current_value),
    renewal_cost: toNumber(row.renewal_cost),
    auto_renew: toBoolean(row.auto_renew),
  };
}

const CERTIFICATE_META = ['id', 'domain_id', 'created_at', 'updated_at'];

const certificateOf = (certificate: Record<string, unknown>) =>
  omit(certificate, CERTIFICATE_META);

import { Injectable, inject } from '@angular/core';
import {
  DatabaseService,
  DbDomain,
  DomainExpiration,
  SaveDomainData,
} from '~/app/../types/Database';
import {
  catchError,
  concatMap,
  from,
  map,
  Observable,
  of,
  retry,
  throwError,
  toArray,
} from 'rxjs';
import { makeEppArrayFromLabels } from '~/app/constants/security-categories';

// Database queries grouped by functionality into sub-services
import { LinkQueries } from '~/app/services/db-query-services/pg/db-links.service';
import { TagQueries } from '~/app/services/db-query-services/pg/db-tags.service';
import { NotificationQueries } from '~/app/services/db-query-services/pg/db-notifications.service';
import { HistoryQueries } from '~/app/services/db-query-services/pg/db-history.service';
import { ValuationQueries } from '~/app/services/db-query-services/pg/db-valuations.service';
import { RegistrarQueries } from '~/app/services/db-query-services/pg/db-registrars.service';
import { DnsQueries } from '~/app/services/db-query-services/pg/db-dns.service';
import { HostsQueries } from '~/app/services/db-query-services/pg/db-hosts.service';
import { IpQueries } from '~/app/services/db-query-services/pg/db-ips.service';
import { SslQueries } from '~/app/services/db-query-services/pg/db-ssl.service';
import { WhoisQueries } from '~/app/services/db-query-services/pg/db-whois.service';
import { StatusQueries } from '~/app/services/db-query-services/pg/db-statuses.service';
import { SubdomainsQueries } from '~/app/services/db-query-services/pg/db-subdomains.service';
import { ExportQueries } from '~/app/services/db-query-services/pg/db-export.service';
import { PgApiUtilService } from '~/app/utils/pg-api.util';
import { ErrorHandlerService } from '../error-handler.service';

@Injectable({
  providedIn: 'root',
})
export default class PgDatabaseService extends DatabaseService {
  private pgApiUtil = inject(PgApiUtilService);
  private errorHandler = inject(ErrorHandlerService);

  private exportQueries: ExportQueries;

  constructor() {
    super();
    this.linkQueries = new LinkQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.listDomains.bind(this),
    );
    this.tagQueries = new TagQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.getCurrentUser.bind(this),
    );
    this.notificationQueries = new NotificationQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.getCurrentUser.bind(this),
    );
    this.historyQueries = new HistoryQueries(this.pgApiUtil, this.handleError.bind(this));
    this.valuationQueries = new ValuationQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
    );
    this.registrarQueries = new RegistrarQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.formatDomainData.bind(this),
    );
    this.dnsQueries = new DnsQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.getCurrentUser.bind(this),
    );
    this.hostsQueries = new HostsQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.formatDomainData.bind(this),
    );
    this.ipQueries = new IpQueries(this.pgApiUtil, this.handleError.bind(this));
    this.sslQueries = new SslQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.getFullDomainQuery.bind(this),
      this.formatDomainData.bind(this),
    );
    this.whoisQueries = new WhoisQueries(this.pgApiUtil, this.handleError.bind(this));
    this.statusQueries = new StatusQueries(this.pgApiUtil, this.handleError.bind(this));
    this.subdomainsQueries = new SubdomainsQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
    );
    this.exportQueries = new ExportQueries(
      this.pgApiUtil,
      this.handleError.bind(this),
      this.getCurrentUser.bind(this),
    );
  }

  private getCurrentUser(): Promise<{ id: string } | null> {
    return Promise.resolve({ id: 'a0000000-aaaa-42a0-a0a0-00a000000a69' });
  }

  private handleError(error: unknown): Observable<never> {
    this.errorHandler.handleError({
      error,
      message: 'Failed to execute Postgres query',
      location: 'pg-database.service',
      showToast: false,
    });
    return throwError(
      () => error || new Error('An error occurred while processing your request.'),
    );
  }

  private executeQuery<T = Record<string, unknown>>(
    query: string,
    params?: unknown[],
  ): Observable<T[]> {
    return this.pgApiUtil
      .postToPgExecutor<T>(query, params as unknown as unknown[] | undefined)
      .pipe(
        map((response) => {
          const maybeError = (response as { error?: string }).error;
          if (maybeError) {
            throw new Error(maybeError);
          }
          return response.data;
        }),
        catchError((error) => this.handleError(error)),
      );
  }

  async domainExists(inputUserId: string | null, domainName: string): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM domains
        WHERE user_id = $1 AND domain_name = $2
      ) AS exists
    `;
    const params = [inputUserId, domainName];
    const result = await this.executeQuery<{ exists: boolean }>(
      query,
      params,
    ).toPromise();
    return Boolean(result?.[0]?.exists);
  }

  saveDomain(data: SaveDomainData): Observable<DbDomain> {
    return from(this.saveDomainInternal(data)).pipe(
      catchError((error) => this.handleError(error)),
    );
  }

  private async saveDomainInternal(data: SaveDomainData): Promise<DbDomain> {
    const query = `
      INSERT INTO domains (domain_name, expiry_date, registration_date, updated_date, notes, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      data.domain.domain_name,
      data.domain.expiry_date,
      data.domain.registration_date,
      data.domain.updated_date,
      data.domain.notes,
      'a0000000-aaaa-42a0-a0a0-00a000000a69',
    ];

    const inserted = await this.executeQuery<{ id: string }>(query, params).toPromise();
    const insertedDomain = inserted?.[0];
    if (!insertedDomain) throw new Error('Failed to insert domain');

    // Save related data
    await Promise.all([
      this.ipQueries.saveIpAddresses(insertedDomain.id, data.ipAddresses),
      this.tagQueries.saveTags(insertedDomain.id, data.tags),
      this.notificationQueries.saveNotifications(insertedDomain.id, data.notifications),
      this.dnsQueries.saveDnsRecords(insertedDomain.id, data.dns),
      this.sslQueries.saveSslInfo(insertedDomain.id, data.ssl),
      this.whoisQueries.saveWhoisInfo(insertedDomain.id, data.whois),
      this.registrarQueries.saveRegistrar(insertedDomain.id, data.registrar),
      this.hostsQueries.saveHost(insertedDomain.id, data.host),
      this.statusQueries.saveStatuses(insertedDomain.id, data.statuses),
      this.subdomainsQueries.saveSubdomains(insertedDomain.id, data.subdomains),
    ]);

    return this.getDomainById(insertedDomain.id);
  }

  async getDomainById(id: string): Promise<DbDomain> {
    const query = `
      SELECT *
      FROM domains
      WHERE id = $1
    `;
    const params = [id];
    const results = await this.executeQuery<DbDomain>(query, params).toPromise();
    const domainData = results?.[0];

    if (!domainData) {
      throw new Error('Failed to fetch domain');
    }
    return domainData;
  }

  getFullDomainQuery(): string {
    return `
      domains.id,
      domains.user_id,
      domains.domain_name,
      domains.expiry_date,
      domains.registration_date,
      domains.updated_date,
      domains.notes,
      domains.created_at,
      domains.registrar_id,

      -- Registrar (1:1 relationship)
      jsonb_build_object(
        'name', registrars.name,
        'url', registrars.url
      ) AS registrar,

      -- WHOIS Information (1:1 relationship)
      jsonb_build_object(
        'name', whois_info.name,
        'organization', whois_info.organization,
        'country', whois_info.country,
        'street', whois_info.street,
        'city', whois_info.city,
        'state', whois_info.state,
        'postal_code', whois_info.postal_code
      ) AS whois_info,

      -- Domain Costings (1:1 relationship)
      jsonb_build_object(
        'purchase_price', domain_costings.purchase_price,
        'current_value', domain_costings.current_value,
        'renewal_cost', domain_costings.renewal_cost,
        'auto_renew', domain_costings.auto_renew
      ) AS domain_costings,

      -- IP Addresses (1:many via LATERAL)
      COALESCE(ip_agg.ip_addresses, '[]'::jsonb) AS ip_addresses,

      -- SSL Certificates (1:many via LATERAL)
      COALESCE(ssl_agg.ssl_certificates, '[]'::jsonb) AS ssl_certificates,

      -- Tags (1:many via LATERAL)
      COALESCE(tags_agg.tags, '[]'::jsonb) AS tags,

      -- Notification Preferences (1:many via LATERAL)
      COALESCE(notif_agg.notification_preferences, '[]'::jsonb) AS notification_preferences,

      -- Hosts (1:many via LATERAL)
      COALESCE(hosts_agg.hosts, '[]'::jsonb) AS hosts,

      -- DNS Records (1:many via LATERAL)
      COALESCE(dns_agg.dns_records, '[]'::jsonb) AS dns_records,

      -- Domain Statuses (1:many via LATERAL)
      COALESCE(statuses_agg.domain_statuses, '[]'::jsonb) AS domain_statuses,

      -- Subdomains (1:many via LATERAL)
      COALESCE(subdomains_agg.sub_domains, '[]'::jsonb) AS sub_domains,

      -- Domain Links (1:many via LATERAL)
      COALESCE(links_agg.domain_links, '[]'::jsonb) AS domain_links
    `;
  }

  getFullDomainJoins(): string {
    return `
      LEFT JOIN registrars ON domains.registrar_id = registrars.id
      LEFT JOIN whois_info ON domains.id = whois_info.domain_id
      LEFT JOIN domain_costings ON domains.id = domain_costings.domain_id

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'ip_address', ip_addresses.ip_address,
            'is_ipv6', ip_addresses.is_ipv6
          )
        ) AS ip_addresses
        FROM ip_addresses
        WHERE ip_addresses.domain_id = domains.id
      ) ip_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'issuer', ssl_certificates.issuer,
            'issuer_country', ssl_certificates.issuer_country,
            'subject', ssl_certificates.subject,
            'valid_from', ssl_certificates.valid_from,
            'valid_to', ssl_certificates.valid_to,
            'fingerprint', ssl_certificates.fingerprint,
            'key_size', ssl_certificates.key_size,
            'signature_algorithm', ssl_certificates.signature_algorithm
          )
        ) AS ssl_certificates
        FROM ssl_certificates
        WHERE ssl_certificates.domain_id = domains.id
      ) ssl_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object('name', tags.name)
        ) AS tags
        FROM domain_tags
        JOIN tags ON domain_tags.tag_id = tags.id
        WHERE domain_tags.domain_id = domains.id
      ) tags_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'notification_type', notification_preferences.notification_type,
            'is_enabled', notification_preferences.is_enabled
          )
        ) AS notification_preferences
        FROM notification_preferences
        WHERE notification_preferences.domain_id = domains.id
      ) notif_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'ip', hosts.ip,
            'lat', hosts.lat,
            'lon', hosts.lon,
            'isp', hosts.isp,
            'org', hosts.org,
            'as_number', hosts.as_number,
            'city', hosts.city,
            'region', hosts.region,
            'country', hosts.country
          )
        ) AS hosts
        FROM domain_hosts
        JOIN hosts ON domain_hosts.host_id = hosts.id
        WHERE domain_hosts.domain_id = domains.id
      ) hosts_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'record_type', dns_records.record_type,
            'record_value', dns_records.record_value
          )
        ) AS dns_records
        FROM dns_records
        WHERE dns_records.domain_id = domains.id
      ) dns_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object('status_code', domain_statuses.status_code)
        ) AS domain_statuses
        FROM domain_statuses
        WHERE domain_statuses.domain_id = domains.id
      ) statuses_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', sub_domains.name,
            'sd_info', sub_domains.sd_info
          )
        ) AS sub_domains
        FROM sub_domains
        WHERE sub_domains.domain_id = domains.id
      ) subdomains_agg ON true

      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'link_name', domain_links.link_name,
            'link_url', domain_links.link_url,
            'link_description', domain_links.link_description
          )
        ) AS domain_links
        FROM domain_links
        WHERE domain_links.domain_id = domains.id
      ) links_agg ON true
    `;
  }

  formatDomainData(data: Record<string, unknown>): DbDomain {
    const dnsRecords =
      (data['dns_records'] as
        | { record_type: string; record_value: string }[]
        | undefined) || [];
    const sslCerts =
      (data['ssl_certificates'] as Record<string, unknown>[] | undefined) || [];
    const hosts = (data['hosts'] as Record<string, unknown>[] | undefined) || [];
    const domainStatuses =
      (data['domain_statuses'] as { status_code: string }[] | undefined) || [];
    const formattedData = {
      ...data,
      tags: this.extractTags(data),
      whois: data['whois_info'],
      dns: {
        mxRecords: dnsRecords
          .filter((record) => record.record_type === 'MX')
          .map((record) => record.record_value),
        txtRecords: dnsRecords
          .filter((record) => record.record_type === 'TXT')
          .map((record) => record.record_value),
        nameServers: dnsRecords
          .filter((record) => record.record_type === 'NS')
          .map((record) => record.record_value),
      },
      ssl: sslCerts[0] || null,
      host: hosts[0] || null,
      statuses: makeEppArrayFromLabels(
        domainStatuses.map((status) => status.status_code),
      ),
    };
    return formattedData as unknown as DbDomain;
  }

  private extractTags(data: Record<string, unknown>): string[] {
    const tags = data['tags'] as { name?: string }[] | undefined;
    return (
      tags?.map((tagItem) => tagItem?.name).filter((n): n is string => Boolean(n)) || []
    );
  }

  listDomains(): Observable<DbDomain[]> {
    const query = `
      SELECT ${this.getFullDomainQuery()}
      FROM domains
      ${this.getFullDomainJoins()}
    `;
    return this.executeQuery(query).pipe(
      map((data) => data.map((domain) => this.formatDomainData(domain))),
      catchError((error) => this.handleError(error)),
    );
  }

  listDomainNames(): Observable<string[]> {
    const query = `
      SELECT LOWER(domain_name) AS domain_name
      FROM domains
    `;

    return this.pgApiUtil.postToPgExecutor<{ domain_name: string }>(query).pipe(
      map(({ data }) => data.map((row) => row.domain_name)),
      retry(3),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomain(domainName: string): Observable<DbDomain> {
    const query = `
      SELECT ${this.getFullDomainQuery()}
      FROM domains
      ${this.getFullDomainJoins()}
      WHERE domains.domain_name = $1
    `;

    return this.pgApiUtil
      .postToPgExecutor<Record<string, unknown>>(query, [domainName])
      .pipe(
        map(({ data }) => {
          if (!data || data.length === 0) {
            throw new Error('Domain not found');
          }
          return this.formatDomainData(data[0]);
        }),
        retry(3),
        catchError((error) => this.handleError(error)),
      );
  }

  updateDomain(domainId: string, domainData: SaveDomainData): Observable<DbDomain> {
    return from(this.updateDomainInternal(domainId, domainData)).pipe(
      catchError((error) => this.handleError(error)),
    );
  }

  private async updateDomainInternal(
    domainId: string,
    data: SaveDomainData,
  ): Promise<DbDomain> {
    const { domain, tags, notifications, subdomains, links } = data;

    // Update domain's basic information
    const updateDomainQuery = `
      UPDATE domains
      SET
        expiry_date = $1,
        notes = $2,
        registrar_id = $3
      WHERE id = $4
      RETURNING *;
    `;
    const registrarValue = (
      domain as unknown as { registrar?: string | { name?: string } }
    ).registrar;
    const registrarName =
      typeof registrarValue === 'string' ? registrarValue : registrarValue?.name || '';
    const registrarId = await this.registrarQueries.getOrInsertRegistrarId(registrarName);
    const domainParams = [domain.expiry_date, domain.notes, registrarId, domainId];
    const updatedDomain = await this.executeQuery(
      updateDomainQuery,
      domainParams,
    ).toPromise();

    if (!updatedDomain || !updatedDomain.length) {
      throw new Error('Failed to update domain');
    }

    // Handle tags
    if (tags) {
      await this.tagQueries.updateTags(domainId, tags);
    }

    // Handle notifications
    if (notifications) {
      await this.notificationQueries.updateNotificationTypes(domainId, notifications);
    }

    // Handle subdomains
    if (subdomains) {
      await this.subdomainsQueries.updateSubdomains(domainId, subdomains);
    }

    // Handle links
    if (links) {
      await this.linkQueries.updateLinks(domainId, links);
    }

    return this.getDomainById(domainId);
  }

  deleteDomain(domainId: string): Observable<void> {
    const query = `
      DO $$
      BEGIN
        -- Delete related records
        DELETE FROM notifications WHERE domain_id = '${domainId}';
        DELETE FROM ip_addresses WHERE domain_id = '${domainId}';
        DELETE FROM domain_tags WHERE domain_id = '${domainId}';
        DELETE FROM notification_preferences WHERE domain_id = '${domainId}';
        DELETE FROM dns_records WHERE domain_id = '${domainId}';
        DELETE FROM ssl_certificates WHERE domain_id = '${domainId}';
        DELETE FROM whois_info WHERE domain_id = '${domainId}';
        DELETE FROM domain_hosts WHERE domain_id = '${domainId}';
        DELETE FROM domain_costings WHERE domain_id = '${domainId}';
        DELETE FROM sub_domains WHERE domain_id = '${domainId}';

        -- Delete the domain itself
        DELETE FROM domains WHERE id = '${domainId}';

        -- Clean up orphaned records
        DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM domain_tags);
        DELETE FROM hosts WHERE id NOT IN (SELECT DISTINCT host_id FROM domain_hosts);
        DELETE FROM registrars WHERE id NOT IN (SELECT DISTINCT registrar_id FROM domains);
      END $$;
    `;

    return from(this.pgApiUtil.postToPgExecutor(query)).pipe(
      map(() => void 0),
      catchError((error) => {
        this.handleError(error);
        return throwError(() => error);
      }),
    );
  }

  getDomainExpirations(): Observable<DomainExpiration[]> {
    const query = `
      SELECT domain_name, expiry_date
      FROM domains
    `;

    return this.pgApiUtil
      .postToPgExecutor<{ domain_name: string; expiry_date: string }>(query)
      .pipe(
        map(({ data }) =>
          data.map((d) => ({
            domain: d.domain_name,
            expiration: new Date(d.expiry_date),
          })),
        ),
        catchError((error) => this.handleError(error)),
      );
  }

  getAssetCount(assetType: string): Observable<number> {
    const tableMap: Record<string, string> = {
      registrars: 'registrars',
      'ip addresses': 'ip_addresses',
      'ssl certificates': 'ssl_certificates',
      hosts: 'hosts',
      'dns records': 'dns_records',
      tags: 'tags',
      links: 'domain_links',
      subdomains: 'sub_domains',
      'domain statuses': 'domain_statuses',
    };

    const table = tableMap[assetType];
    if (!table) {
      throw new Error(`Unknown asset type: ${assetType}`);
    }

    const query = `
      SELECT COUNT(*) AS count
      FROM ${table}
    `;

    return this.pgApiUtil.postToPgExecutor<{ count: string }>(query).pipe(
      map(({ data }) => (data?.[0]?.count ? parseInt(data[0].count, 10) : 0)),
      catchError((error) => this.handleError(error)),
    );
  }

  getStatusesWithDomainCounts(): Observable<
    { eppCode: string; description: string; domainCount: number }[]
  > {
    const query = `
      SELECT 
        domain_statuses.status_code AS epp_code,
        COUNT(domain_statuses.domain_id) AS domain_count
      FROM 
        domain_statuses
      GROUP BY 
        domain_statuses.status_code
      ORDER BY 
        domain_count DESC;
    `;

    return this.pgApiUtil
      .postToPgExecutor<{ epp_code: string; domain_count: number }>(query)
      .pipe(
        map(({ data }) =>
          data.map((item) => ({
            eppCode: item.epp_code,
            description: '', // You can populate the description if necessary
            domainCount: Number(item.domain_count),
          })),
        ),
        catchError((error) => this.handleError(error)),
      );
  }
  getDomainsByStatus(statusCode: string): Observable<DbDomain[]> {
    const query = `
      SELECT ${this.getFullDomainQuery()}
      FROM domains
      ${this.getFullDomainJoins()}
      WHERE EXISTS (
        SELECT 1 FROM domain_statuses
        WHERE domain_statuses.domain_id = domains.id
        AND domain_statuses.status_code = $1
      )
    `;

    return this.pgApiUtil
      .postToPgExecutor<Record<string, unknown>>(query, [statusCode])
      .pipe(
        map(({ data }) => data.map((domain) => this.formatDomainData(domain))),
        catchError((error) => this.handleError(error)),
      );
  }

  private getTimeIntervalForTimeframe(timeframe: string): string {
    switch (timeframe) {
      case 'day':
        return '1 day';
      case 'week':
        return '1 week';
      case 'month':
        return '1 month';
      case 'year':
        return '1 year';
      default:
        return '1 day';
    }
  }

  getDomainsByTag(tagName: string): Observable<DbDomain[]> {
    const query = `
      SELECT ${this.getFullDomainQuery()}
      FROM domains
      ${this.getFullDomainJoins()}
      WHERE EXISTS (
        SELECT 1 FROM domain_tags
        JOIN tags ON domain_tags.tag_id = tags.id
        WHERE domain_tags.domain_id = domains.id
        AND tags.name = $1
      )
    `;

    return from(
      this.pgApiUtil.postToPgExecutor<Record<string, unknown>>(query, [tagName]),
    ).pipe(
      map(({ data }) => {
        if (!data || data.length === 0) {
          return [];
        }
        return data.map((domain) => this.formatDomainData(domain));
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  async getDomainUptime(
    userId: string,
    domainId: string,
    timeframe: string,
  ): Promise<
    {
      checked_at: string;
      is_up: boolean;
      response_code: number;
      response_time_ms: number;
      dns_lookup_time_ms: number;
      ssl_handshake_time_ms: number;
    }[]
  > {
    const timeInterval = this.getTimeIntervalForTimeframe(timeframe);

    const query = `
      SELECT
        u.checked_at,
        u.is_up,
        u.response_code,
        u.response_time_ms,
        u.dns_lookup_time_ms,
        u.ssl_handshake_time_ms
      FROM
        uptime u
      JOIN
        domains d ON u.domain_id = d.id
      WHERE
        d.user_id = $1
        AND u.domain_id = $2
        AND u.checked_at >= NOW() - $3::INTERVAL
      ORDER BY
        u.checked_at
    `;

    const params = [userId, domainId, timeInterval];

    try {
      const data = await this.executeQuery<{
        checked_at: string;
        is_up: boolean;
        response_code: number;
        response_time_ms: number;
        dns_lookup_time_ms: number;
        ssl_handshake_time_ms: number;
      }>(query, params).toPromise();
      return data || [];
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /* One averaged response time per day, for the uptime calendar heatmap */
  async getDomainUptimeDaily(
    userId: string,
    domainId: string,
    days: number,
  ): Promise<{ day: string; avg_response_time_ms: number | null }[]> {
    const query = `
      SELECT
        to_char(date_trunc('day', u.checked_at), 'YYYY-MM-DD') AS day,
        AVG(u.response_time_ms)::float8 AS avg_response_time_ms
      FROM uptime u
      JOIN domains d ON u.domain_id = d.id
      WHERE d.user_id = $1
        AND u.domain_id = $2
        AND u.checked_at >= NOW() - make_interval(days => $3::int)
      GROUP BY 1
      ORDER BY 1
    `;

    const data = await this.executeQuery<{
      day: string;
      avg_response_time_ms: number | null;
    }>(query, [userId, domainId, days]).toPromise();
    return data || [];
  }

  getTotalDomains(): Observable<number> {
    const query = `
      SELECT COUNT(*) AS total
      FROM domains
    `;

    return this.pgApiUtil.postToPgExecutor<{ total: string }>(query).pipe(
      map(({ data }) => {
        if (!data || data.length === 0) {
          throw new Error('Failed to fetch total domains count');
        }
        return parseInt(data[0].total, 10) || 0;
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainsByEppCodes(
    statuses: string[],
  ): Observable<Record<string, { domainId: string; domainName: string }[]>> {
    const query = `
      SELECT 
        domain_statuses.status_code, 
        domains.id AS domain_id, 
        domains.domain_name
      FROM 
        domain_statuses
      INNER JOIN 
        domains ON domain_statuses.domain_id = domains.id
      WHERE 
        domain_statuses.status_code = ANY($1::text[])
    `;

    const params = [statuses];

    return this.pgApiUtil
      .postToPgExecutor<
        { status_code: string; domain_id: string; domain_name: string }[]
      >(query, params)
      .pipe(
        map(({ data }) => {
          if (!data || data.length === 0) {
            return statuses.reduce((acc, status) => ({ ...acc, [status]: [] }), {});
          }

          const domainsByStatus: Record<
            string,
            { domainId: string; domainName: string }[]
          > = {};

          statuses.forEach((status) => {
            domainsByStatus[status] = (
              data as unknown as {
                status_code: string;
                domain_id: string;
                domain_name: string;
              }[]
            )
              .filter((d) => d.status_code === status)
              .map((d) => ({ domainId: d.domain_id, domainName: d.domain_name }));
          });

          return domainsByStatus;
        }),
        catchError((error) => this.handleError(error)),
      );
  }

  fetchAllForExport(
    domainNames: string,
    includeFields: string[] | { label: string; value: string }[],
  ): Observable<Record<string, unknown>[]> {
    return this.exportQueries.fetchAllForExport(domainNames, includeFields);
  }

  checkAllTables(): Observable<
    { table: string; count: number | string; success: string }[]
  > {
    const allTables = [
      'dns_records',
      'domain_costings',
      'domain_hosts',
      'domain_links',
      'domain_statuses',
      'domain_tags',
      'domain_updates',
      'ip_addresses',
      'notification_preferences',
      'ssl_certificates',
      'sub_domains',
      'uptime',
      'whois_info',
      'billing',
      'notifications',
      'hosts',
      'registrars',
      'tags',
      'users',
      'user_info',
      'domains',
    ];

    const idColName = (tableName: string) => {
      if (tableName === 'domain_tags') return 'tag_id';
      if (tableName === 'domain_hosts') return 'host_id';
      return 'id';
    };

    return from(allTables).pipe(
      concatMap((tableName) => {
        const query = `SELECT COUNT(${idColName(tableName)}) AS count FROM ${tableName}`;
        return from(this.pgApiUtil.postToPgExecutor(query)).pipe(
          map(({ data }) => {
            if (data.length > 0) {
              const count = (data[0] as { count: number }).count ?? 0;
              return { table: tableName, count, success: '✅' };
            }
            return { table: tableName, count: 'zilch', success: '❌' };
          }),
          catchError((err) => {
            this.handleError({
              error: err,
              message: `Failed to read table "${tableName}"`,
              location: 'DbDiagnosticsService.checkAllTables',
              showToast: true,
            });
            return of({ table: tableName, count: 'zilch', success: '❌' });
          }),
        );
      }),
      toArray(),
    );
  }

  async deleteAllData(userId: string, tables?: string[]): Promise<void> {
    // Fetch all domain IDs belonging to the user
    const fetchDomainsQuery = `SELECT id FROM domains WHERE user_id = $1`;
    const result = await this.pgApiUtil
      .postToPgExecutor(fetchDomainsQuery, [userId])
      .toPromise();
    const domainRows = (result?.data || []) as { id: string }[];
    const domainIds = domainRows.map((d) => d.id);

    // Tables categorized by deletion method
    const domainBasedTablesAll = [
      'dns_records',
      'domain_costings',
      'domain_hosts',
      'domain_links',
      'domain_statuses',
      'domain_tags',
      'domain_updates',
      'ip_addresses',
      'notification_preferences',
      'ssl_certificates',
      'sub_domains',
      'uptime',
      'whois_info',
    ];

    const userBasedTablesAll = [
      'billing',
      'domain_updates',
      'notifications',
      'hosts',
      'registrars',
      'tags',
      'user_info',
    ];

    // Determine which tables to target if specific tables are provided
    const domainBasedTables = tables
      ? domainBasedTablesAll.filter((t) => tables.includes(t))
      : domainBasedTablesAll;

    const userBasedTables = tables
      ? userBasedTablesAll.filter((t) => tables.includes(t))
      : userBasedTablesAll;

    const mustDeleteDomains = !tables || tables.includes('domains');

    // Delete domain-based records
    for (const table of domainBasedTables) {
      if (domainIds.length > 0) {
        const deleteDomainRecordsQuery = `DELETE FROM ${table} WHERE domain_id = ANY($1)`;
        await this.pgApiUtil
          .postToPgExecutor(deleteDomainRecordsQuery, [domainIds])
          .toPromise();
      }
    }

    // Delete user-based records
    for (const table of userBasedTables) {
      const deleteUserRecordsQuery = `DELETE FROM ${table} WHERE user_id = $1`;
      await this.pgApiUtil.postToPgExecutor(deleteUserRecordsQuery, [userId]).toPromise();
    }

    // Delete domains themselves
    if (mustDeleteDomains) {
      const deleteDomainsQuery = `DELETE FROM domains WHERE user_id = $1`;
      await this.pgApiUtil.postToPgExecutor(deleteDomainsQuery, [userId]).toPromise();
    }
  }
}

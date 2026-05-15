import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '~/app/services/supabase.service';
import {
  DatabaseService,
  DbDomain,
  SaveDomainData,
  DomainExpiration,
} from '~/app/../types/Database';
import {
  catchError,
  from,
  map,
  Observable,
  throwError,
  retry,
  switchMap,
  toArray,
  of,
  concatMap,
} from 'rxjs';
import { makeEppArrayFromLabels } from '~/app/constants/security-categories';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { GlobalMessageService } from '~/app/services/messaging.service';

// Database queries grouped by functionality into sub-services
import { LinkQueries } from '~/app/services/db-query-services/sb/db-links.service';
import { TagQueries } from '~/app/services/db-query-services/sb/db-tags.service';
import { NotificationQueries } from '~/app/services/db-query-services/sb/db-notifications.service';
import { HistoryQueries } from '~/app/services/db-query-services/sb/db-history.service';
import { ValuationQueries } from '~/app/services/db-query-services/sb/db-valuations.service';
import { RegistrarQueries } from '~/app/services/db-query-services/sb/db-registrars.service';
import { DnsQueries } from '~/app/services/db-query-services/sb/db-dns.service';
import { HostsQueries } from '~/app/services/db-query-services/sb/db-hosts.service';
import { IpQueries } from '~/app/services/db-query-services/sb/db-ips.service';
import { SslQueries } from '~/app/services/db-query-services/sb/db-ssl.service';
import { WhoisQueries } from '~/app/services/db-query-services/sb/db-whois.service';
import { StatusQueries } from '~/app/services/db-query-services/sb/db-statuses.service';
import { SubdomainsQueries } from '~/app/services/db-query-services/sb/db-subdomains.service';

import { createDbProxy } from '~/app/utils/db-proxy.factory';
import { FeatureService } from '../features.service';

@Injectable({
  providedIn: 'root',
})
export default class MainDatabaseService extends DatabaseService {
  private supabase = inject(SupabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private globalMessagingService = inject(GlobalMessageService);
  private featureService = inject(FeatureService);

  constructor() {
    super();

    type SubserviceCtor = new (...args: never[]) => unknown;
    const subservices: {
      property: string;
      cls: SubserviceCtor;
      args: readonly unknown[];
    }[] = [
      {
        property: 'tagQueries',
        cls: TagQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
        ],
      },
      {
        property: 'linkQueries',
        cls: LinkQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.listDomainNames.bind(this),
        ],
      },
      {
        property: 'notificationQueries',
        cls: NotificationQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
        ],
      },
      {
        property: 'historyQueries',
        cls: HistoryQueries,
        args: [this.supabase.supabase, this.handleError.bind(this)],
      },
      {
        property: 'valuationQueries',
        cls: ValuationQueries,
        args: [this.supabase.supabase, this.handleError.bind(this)],
      },
      {
        property: 'registrarQueries',
        cls: RegistrarQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
          this.formatDomainData.bind(this),
        ],
      },
      {
        property: 'dnsQueries',
        cls: DnsQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
        ],
      },
      {
        property: 'hostsQueries',
        cls: HostsQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.formatDomainData.bind(this),
        ],
      },
      {
        property: 'ipQueries',
        cls: IpQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
        ],
      },
      {
        property: 'sslQueries',
        cls: SslQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
          this.getFullDomainQuery.bind(this),
          this.formatDomainData.bind(this),
        ],
      },
      {
        property: 'whoisQueries',
        cls: WhoisQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
        ],
      },
      {
        property: 'statusQueries',
        cls: StatusQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.getCurrentUser.bind(this),
        ],
      },
      {
        property: 'subdomainsQueries',
        cls: SubdomainsQueries,
        args: [
          this.supabase.supabase,
          this.handleError.bind(this),
          this.globalMessagingService,
        ],
      },
    ] as const;

    // Instantiate each subservice, wrap it in write protection proxy
    subservices.forEach(({ property, cls, args }) => {
      const real = new (cls as new (...a: unknown[]) => unknown)(...args);
      const proxied = createDbProxy(
        real as object,
        this.featureService,
        this.globalMessagingService,
      );
      (this as unknown as Record<string, unknown>)[property] = proxied;
    });
  }

  private handleError(error: unknown): Observable<never> {
    this.errorHandler.handleError({
      error,
      message: 'Failed to execute DB query',
      location: 'database.service',
      showToast: false,
    });
    return throwError(
      () => error || new Error('An error occurred while processing your request.'),
    );
  }

  async getCurrentUser() {
    return this.supabase.getCurrentUser();
  }

  async domainExists(inputUserId: string | null, domainName: string): Promise<boolean> {
    let userId = inputUserId;
    if (!inputUserId) {
      userId = (await this.supabase.getCurrentUser().then((user) => user?.id)) || '';
    }
    const { data, error } = await this.supabase.supabase
      .from('domains')
      .select('id')
      .eq('user_id', userId)
      .eq('domain_name', domainName)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error);
    }
    return !!data;
  }

  saveDomain(data: SaveDomainData): Observable<DbDomain> {
    return from(this.saveDomainInternal(data)).pipe(
      catchError((error) => this.handleError(error)),
    );
  }

  // saveDomain(data: SaveDomainData): Observable<DbDomain> {
  //   if (!this.featureService.isFeatureEnabled('writePermissions')) {
  //     return throwError(() => new Error('Write permissions disabled'));
  //   }

  //   // Fetch the current domain list => check plan’s domainLimit => duplicates
  //   return this.listDomainNames().pipe(
  //     switchMap((existingDomains) => {
  //       // Check if domain is already in the list
  //       const newDomain = data.domain.domain_name.toLowerCase().trim();
  //       if (existingDomains.includes(newDomain)) {
  //         return throwError(() => new Error(`Domain "${newDomain}" already exists.`));
  //       }

  //       // Get domainLimit from featureService
  //       return this.featureService.getFeatureValue<number>('domainLimit').pipe(
  //         switchMap((limit) => {
  //           // If limit is not a number or 0 => fallback to big number
  //           const domainLimit = typeof limit === 'number' ? limit : 10000;

  //           // If user already has domainLimit or more => throw
  //           if (existingDomains.length >= domainLimit) {
  //             return throwError(() => new Error(`You have reached your limit of ${domainLimit} domains. Please upgrade.`));
  //           }

  //           // Save the domain
  //           return from(this.saveDomainInternal(data));
  //         })
  //       );
  //     }),
  //     catchError(error => this.handleError(error))
  //   );
  // }

  private async saveDomainInternal(data: SaveDomainData): Promise<DbDomain> {
    const isWriteEnabled =
      await this.featureService.isFeatureEnabledPromise('writePermissions');
    if (!isWriteEnabled) {
      throw new Error('Write permissions disabled');
    }

    const {
      domain,
      ipAddresses,
      tags,
      notifications,
      dns,
      ssl,
      whois,
      registrar,
      host,
      statuses,
      subdomains,
    } = data;

    const dbDomain: Partial<DbDomain> = {
      domain_name: domain.domain_name,
      expiry_date: domain.expiry_date,
      registration_date: domain.registration_date,
      updated_date: domain.updated_date,
      notes: domain.notes,
      user_id: await this.supabase.getCurrentUser().then((user) => user?.id),
    };

    const { data: insertedDomain, error: domainError } = await this.supabase.supabase
      .from('domains')
      .insert(dbDomain)
      .select()
      .single();

    if (domainError) this.handleError(domainError);
    if (!insertedDomain) this.handleError(new Error('Failed to insert domain'));

    await Promise.all([
      this.ipQueries.saveIpAddresses(insertedDomain.id, ipAddresses),
      this.tagQueries.saveTags(insertedDomain.id, tags),
      this.notificationQueries.saveNotifications(insertedDomain.id, notifications),
      this.dnsQueries.saveDnsRecords(insertedDomain.id, dns),
      this.sslQueries.saveSslInfo(insertedDomain.id, ssl),
      this.whoisQueries.saveWhoisInfo(insertedDomain.id, whois),
      this.registrarQueries.saveRegistrar(insertedDomain.id, registrar),
      this.hostsQueries.saveHost(insertedDomain.id, host),
      this.statusQueries.saveStatuses(insertedDomain.id, statuses),
      this.subdomainsQueries.saveSubdomains(insertedDomain.id, subdomains),
    ]);

    return this.getDomainById(insertedDomain.id);
  }

  async getDomainById(id: string): Promise<DbDomain> {
    const { data, error } = await this.supabase.supabase
      .from('domains')
      .select(this.getFullDomainQuery())
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to fetch complete domain data');
    return this.formatDomainData(data as unknown as Record<string, unknown>);
  }

  private getFullDomainQuery(): string {
    return `
      *,
      registrars (name, url),
      ip_addresses (ip_address, is_ipv6),
      ssl_certificates (issuer, issuer_country, subject, valid_from, valid_to, fingerprint, key_size, signature_algorithm),
      whois_info (name, organization, country, street, city, state, postal_code),
      domain_tags (tags (name)),
      notification_preferences (notification_type, is_enabled),
      domain_hosts (hosts (ip, lat, lon, isp, org, as_number, city, region, country)),
      dns_records (record_type, record_value),
      domain_statuses (status_code),
      domain_costings (purchase_price, current_value, renewal_cost, auto_renew),
      sub_domains (name, sd_info),
      domain_links (link_name, link_url, link_description)
    `;
  }

  deleteDomain(domainId: string): Observable<void> {
    return this.featureService.isFeatureEnabled('writePermissions').pipe(
      map((isEnabled) => {
        if (!isEnabled) {
          this.globalMessagingService.showWarn(
            'Write permissions are disabled',
            'Skipping delete operation',
          );
          throw new Error('Write permissions disabled');
        }
      }),
      switchMap(() =>
        from(this.supabase.supabase.rpc('delete_domain', { domain_id: domainId })),
      ),
      map(() => void 0),
      catchError((error) => {
        return throwError(() => error || new Error('Failed to delete domain'));
      }),
    );
  }

  getDomain(domainName: string): Observable<DbDomain> {
    return from(
      this.supabase.supabase
        .from('domains')
        .select(this.getFullDomainQuery())
        .eq('domain_name', domainName)
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Domain not found');
        return this.formatDomainData(data as unknown as Record<string, unknown>);
      }),
      retry(3),
      catchError((error) => this.handleError(error)),
    );
  }

  private extractTags(data: Record<string, unknown>): string[] {
    const domainTags = data['domain_tags'];
    if (Array.isArray(domainTags)) {
      return (domainTags as { tags?: { name?: string } }[])
        .filter((tagItem) => tagItem.tags && tagItem.tags.name)
        .map((tagItem) => tagItem.tags!.name!);
    } else if (data['tags']) {
      return [String(data['tags'])];
    }
    return [];
  }

  private formatDomainData(data: Record<string, unknown>): DbDomain {
    const sslCerts =
      (data['ssl_certificates'] as Record<string, unknown>[] | undefined) || [];
    const dnsRecords =
      (data['dns_records'] as
        | { record_type: string; record_value: string }[]
        | undefined) || [];
    const domainHosts =
      (data['domain_hosts'] as { hosts: Record<string, unknown> }[] | undefined) || [];
    const domainStatuses =
      (data['domain_statuses'] as { status_code: string }[] | undefined) || [];
    return {
      ...data,
      tags: this.extractTags(data),
      ssl: sslCerts.length ? sslCerts[0] : null,
      whois: data['whois_info'],
      registrar: data['registrars'],
      host: domainHosts.length > 0 ? domainHosts[0].hosts : null,
      dns: {
        mxRecords: dnsRecords
          .filter((r) => r.record_type === 'MX')
          .map((r) => r.record_value),
        txtRecords: dnsRecords
          .filter((r) => r.record_type === 'TXT')
          .map((r) => r.record_value),
        nameServers: dnsRecords
          .filter((r) => r.record_type === 'NS')
          .map((r) => r.record_value),
      },
      statuses: makeEppArrayFromLabels(domainStatuses.map((s) => s.status_code)),
    } as unknown as DbDomain;
  }

  listDomainNames(): Observable<string[]> {
    return from(this.supabase.supabase.from('domains').select('domain_name')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((d) => d.domain_name.toLowerCase());
      }),
      retry(3),
      catchError((error) => this.handleError(error)),
    );
  }

  listDomains(): Observable<DbDomain[]> {
    return from(
      this.supabase.supabase.from('domains').select(this.getFullDomainQuery()),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as unknown as Record<string, unknown>[]).map((domain) =>
          this.formatDomainData(domain),
        );
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

    const registrarValue = (
      domain as unknown as { registrar?: string | { name?: string } }
    ).registrar;
    const registrarName =
      typeof registrarValue === 'string' ? registrarValue : registrarValue?.name || '';

    // Update domain's basic information
    const { data: updatedDomain, error: updateError } = await this.supabase.supabase
      .from('domains')
      .update({
        expiry_date: domain.expiry_date,
        notes: domain.notes,
        registrar_id: await this.registrarQueries.getOrInsertRegistrarId(registrarName),
      })
      .eq('id', domainId)
      .select()
      .single();

    if (updateError) throw updateError;
    if (!updatedDomain) throw new Error('Failed to update domain');

    // Handle tags
    await this.tagQueries.updateTags(domainId, tags);

    // Handle notifications
    if (notifications) {
      await this.notificationQueries.updateNotificationTypes(domainId, notifications);
    }

    // Handle subdomains
    await this.subdomainsQueries.updateSubdomains(domainId, subdomains);

    // Handle links
    if (links) {
      await this.linkQueries.updateLinks(domainId, links);
    }

    return this.getDomainById(domainId);
  }

  getStatusesWithDomainCounts(): Observable<
    { eppCode: string; description: string; domainCount: number }[]
  > {
    return from(
      this.supabase.supabase.rpc('get_statuses_with_domain_counts'), // Use the updated RPC function
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map((item: { status_code: string; domain_count: number }) => ({
          eppCode: item.status_code,
          description: '',
          // description: this.getDescriptionForStatus(item.status_code),
          domainCount: item.domain_count,
        }));
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  // Method to get the total number of domains
  getTotalDomains(): Observable<number> {
    return from(
      this.supabase.supabase.from('domains').select('id', { count: 'exact' }),
    ).pipe(
      map(({ count, error }) => {
        if (error) throw error;
        return count || 0;
      }),
    );
  }

  getDomainsByEppCodes(
    statuses: string[],
  ): Observable<Record<string, { domainId: string; domainName: string }[]>> {
    return from(
      this.supabase.supabase.rpc('get_domains_by_epp_status_codes', {
        status_codes: statuses,
      }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const domainsByStatus: Record<
          string,
          { domainId: string; domainName: string }[]
        > = {};
        statuses.forEach((status) => {
          domainsByStatus[status] = (
            data as { status_code: string; domain_id: string; domain_name: string }[]
          )
            .filter((d) => d.status_code === status)
            .map((d) => ({ domainId: d.domain_id, domainName: d.domain_name }));
        });
        return domainsByStatus;
      }),
    );
  }

  getDomainsByStatus(statusCode: string): Observable<DbDomain[]> {
    return from(
      this.supabase.supabase
        .from('domains')
        .select(
          `
        *,
        registrars (name, url),
        ip_addresses (ip_address, is_ipv6),
        ssl_certificates (issuer, issuer_country, subject, valid_from, valid_to, fingerprint, key_size, signature_algorithm),
        whois_info (name, organization, country, street, city, state, postal_code),
        domain_hosts (
          hosts (
            ip, lat, lon, isp, org, as_number, city, region, country
          )
        ),
        dns_records (record_type, record_value),
        domain_tags (
          tags (name)
        ),
        domain_statuses!inner (status_code)
      `,
        )
        .eq('domain_statuses.status_code', statusCode),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map((domain) => this.formatDomainData(domain));
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainsByTag(tagName: string): Observable<DbDomain[]> {
    return from(
      this.supabase.supabase
        .from('domains')
        .select(
          `
        *,
        registrars (name, url),
        ip_addresses (ip_address, is_ipv6),
        ssl_certificates (issuer, issuer_country, subject, valid_from, valid_to, fingerprint, key_size, signature_algorithm),
        whois_info (name, organization, country, street, city, state, postal_code),
        domain_hosts (
          hosts (
            ip, lat, lon, isp, org, as_number, city, region, country
          )
        ),
        dns_records (record_type, record_value),
        domain_tags!inner (
          tags!inner (name)
        )
      `,
        )
        .eq('domain_tags.tags.name', tagName),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map((domain) => this.formatDomainData(domain));
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainExpirations(): Observable<DomainExpiration[]> {
    return from(
      this.supabase.supabase.from('domains').select('domain_name, expiry_date'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map((d) => ({
          domain: d.domain_name,
          expiration: new Date(d.expiry_date),
        }));
      }),
    );
  }

  getAssetCount(assetType: string): Observable<number> {
    let table: string;
    switch (assetType) {
      case 'registrars':
        table = 'registrars';
        break;
      case 'ip addresses':
        table = 'ip_addresses';
        break;
      case 'ssl certificates':
        table = 'ssl_certificates';
        break;
      case 'hosts':
        table = 'hosts';
        break;
      case 'dns records':
        table = 'dns_records';
        break;
      case 'tags':
        table = 'tags';
        break;
      case 'links':
        table = 'domain_links';
        break;
      case 'subdomains':
        table = 'sub_domains';
        break;
      case 'domain statuses':
        table = 'domain_statuses';
        break;
      default:
        throw new Error(`Unknown asset type: ${assetType}`);
    }

    return from(this.supabase.supabase.from(table).select('id', { count: 'exact' })).pipe(
      map((response) => response.count || 0),
    );
  }

  fetchAllForExport(
    domainName: string,
    includeFields: string[] | { label: string; value: string }[],
  ): Observable<Record<string, unknown>[]> {
    const fieldMap: Record<string, string> = {
      domain_statuses: 'domain_statuses(status_code)',
      ip_addresses: 'ip_addresses(ip_address, is_ipv6)',
      whois_info:
        'whois_info(name, organization, country, street, city, state, postal_code)',
      domain_tags: 'domain_tags(tags(name))',
      ssl_certificates:
        'ssl_certificates(issuer, issuer_country, subject, valid_from, valid_to, fingerprint, key_size, signature_algorithm)',
      notifications: 'notification_preferences(notification_type, is_enabled)',
      domain_hosts:
        'domain_hosts(hosts(ip, lat, lon, isp, org, as_number, city, region, country))',
      dns_records: 'dns_records(record_type, record_value)',
      domain_costings:
        'domain_costings(purchase_price, current_value, renewal_cost, auto_renew)',
    };

    // Always include registrar
    let selectQuery = '*, registrars(name, url)';

    const fields = Array.isArray(includeFields) ? includeFields : [];
    if (fields.length > 0) {
      const selectedRelations = fields
        .map((field) => {
          const fieldValue = typeof field === 'string' ? field : field?.value;
          return fieldMap[fieldValue];
        })
        .filter(Boolean);

      if (selectedRelations.length > 0) {
        selectQuery += ', ' + selectedRelations.join(', ');
      }
    }

    return from(this.getCurrentUser()).pipe(
      switchMap((user) => {
        if (!user) throw new Error('User not authenticated');

        let query = this.supabase.supabase
          .from('domains')
          .select(selectQuery)
          .eq('user_id', user.id)
          .limit(10000);

        const domainFilter = (domainName || '').trim();
        if (domainFilter) {
          query = query.in(
            'domain_name',
            domainFilter.split(',').map((d) => d.trim()),
          );
        }

        return from(query);
      }),
      map(({ data, error }) => {
        if (error) throw error;

        interface ExportSbDomainRow {
          registrars?: { name?: string; url?: string } | null;
          ip_addresses?: { ip_address?: string }[];
          ssl_certificates?: { issuer?: string }[];
          whois_info?: {
            name?: string;
            organization?: string;
            country?: string;
            street?: string;
            city?: string;
            state?: string;
            postal_code?: string;
          } | null;
          domain_tags?: { tags?: { name?: string } | null }[];
          domain_hosts?: { hosts?: { isp?: string } | null }[];
          dns_records?: { record_type: string; record_value: string }[];
          domain_costings?: {
            purchase_price?: number;
            current_value?: number;
            renewal_cost?: number;
            auto_renew?: boolean;
          } | null;
          [k: string]: unknown;
        }
        // Flatten the nested data for CSV export
        const flattenedData = (data as unknown as ExportSbDomainRow[]).map((domain) => ({
          ...domain,
          registrar_name: domain.registrars?.name || '',
          registrar_url: domain.registrars?.url || '',
          ip_addresses: domain.ip_addresses
            ? domain.ip_addresses
                .map((ip) => ip.ip_address)
                .filter(Boolean)
                .join(', ')
            : '',
          ssl_certificates: domain.ssl_certificates
            ? domain.ssl_certificates
                .map((cert) => cert.issuer)
                .filter(Boolean)
                .join(', ')
            : '',
          whois_name: domain.whois_info?.name || '',
          whois_organization: domain.whois_info?.organization || '',
          whois_country: domain.whois_info?.country || '',
          whois_street: domain.whois_info?.street || '',
          whois_city: domain.whois_info?.city || '',
          whois_state: domain.whois_info?.state || '',
          whois_postal_code: domain.whois_info?.postal_code || '',
          tags: domain.domain_tags
            ? domain.domain_tags
                .map((tag) => tag.tags?.name)
                .filter(Boolean)
                .join(', ')
            : '',
          hosts: domain.domain_hosts
            ? domain.domain_hosts
                .map((host) => host.hosts?.isp)
                .filter(Boolean)
                .join(', ')
            : '',
          dns_records: domain.dns_records
            ? domain.dns_records
                .map((record) => `${record.record_type}: ${record.record_value}`)
                .filter(Boolean)
                .join('; ')
            : '',
          purchase_price: domain.domain_costings?.purchase_price || 0,
          current_value: domain.domain_costings?.current_value || 0,
          renewal_cost: domain.domain_costings?.renewal_cost || 0,
          auto_renew: domain.domain_costings?.auto_renew ? 'Yes' : 'No',
        }));

        return flattenedData;
      }),
      catchError((error) => {
        this.errorHandler.handleError({
          message: 'Error exporting domain data',
          error,
          location: 'MainDatabaseService.fetchAllForExport',
          showToast: true,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Fetch domain uptime data for the given user and domain.
   * @param userId The ID of the user
   * @param domainId The ID of the domain
   * @param timeframe The timeframe to filter data (e.g., 'day', 'week', etc.)
   */
  getDomainUptime(userId: string, domainId: string, timeframe: string) {
    return this.supabase.supabase.rpc('get_domain_uptime', {
      user_id: userId,
      domain_id: domainId,
      timeframe: timeframe,
    });
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
        return from(
          this.supabase.supabase
            .from(tableName)
            .select(idColName(tableName), { count: 'exact' }),
        ).pipe(
          map((resp) => {
            if (resp.status >= 200 && resp.status < 300) {
              const count = resp.count ?? 0;
              return { table: tableName, count, success: '✅' };
            }
            return { table: tableName, count: resp.count || 'zilch', success: '❌' };
          }),
          catchError((err) => {
            this.errorHandler.handleError({
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

  async deleteAllData(userId: string, tables?: string[]) {
    this.supabase.deleteAllData(userId, tables);
  }
}

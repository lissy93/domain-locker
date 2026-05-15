import { type SecurityCategory } from '~/app/constants/security-categories';
import {
  Timestamps,
  IpAddresses,
  Registrar,
  Contact,
  Dns,
  Ssl,
  Host,
  Valuation,
  Tag,
  Notification,
  Subdomain,
  Link,
} from './common';
import { DnsQueries as SbDnsQueries } from '~/app/services/db-query-services/sb/db-dns.service';
import { HistoryQueries as SbHistoryQueries } from '~/app/services/db-query-services/sb/db-history.service';
import { HostsQueries as SbHostsQueries } from '~/app/services/db-query-services/sb/db-hosts.service';
import { IpQueries as SbIpQueries } from '~/app/services/db-query-services/sb/db-ips.service';
import { LinkQueries as SbLinkQueries } from '~/app/services/db-query-services/sb/db-links.service';
import { NotificationQueries as SbNotificationQueries } from '~/app/services/db-query-services/sb/db-notifications.service';
import { RegistrarQueries as SbRegistrarQueries } from '~/app/services/db-query-services/sb/db-registrars.service';
import { SslQueries as SbSslQueries } from '~/app/services/db-query-services/sb/db-ssl.service';
import { StatusQueries as SbStatusQueries } from '~/app/services/db-query-services/sb/db-statuses.service';
import { SubdomainsQueries as SbSubdomainsQueries } from '~/app/services/db-query-services/sb/db-subdomains.service';
import { TagQueries as SbTagQueries } from '~/app/services/db-query-services/sb/db-tags.service';
import { ValuationQueries as SbValuationQueries } from '~/app/services/db-query-services/sb/db-valuations.service';
import { WhoisQueries as SbWhoisQueries } from '~/app/services/db-query-services/sb/db-whois.service';

import { DnsQueries as PgDnsQueries } from '~/app/services/db-query-services/pg/db-dns.service';
import { HistoryQueries as PgHistoryQueries } from '~/app/services/db-query-services/pg/db-history.service';
import { HostsQueries as PgHostsQueries } from '~/app/services/db-query-services/pg/db-hosts.service';
import { IpQueries as PgIpQueries } from '~/app/services/db-query-services/pg/db-ips.service';
import { LinkQueries as PgLinkQueries } from '~/app/services/db-query-services/pg/db-links.service';
import { NotificationQueries as PgNotificationQueries } from '~/app/services/db-query-services/pg/db-notifications.service';
import { RegistrarQueries as PgRegistrarQueries } from '~/app/services/db-query-services/pg/db-registrars.service';
import { SslQueries as PgSslQueries } from '~/app/services/db-query-services/pg/db-ssl.service';
import { StatusQueries as PgStatusQueries } from '~/app/services/db-query-services/pg/db-statuses.service';
import { SubdomainsQueries as PgSubdomainsQueries } from '~/app/services/db-query-services/pg/db-subdomains.service';
import { TagQueries as PgTagQueries } from '~/app/services/db-query-services/pg/db-tags.service';
import { ValuationQueries as PgValuationQueries } from '~/app/services/db-query-services/pg/db-valuations.service';
import { WhoisQueries as PgWhoisQueries } from '~/app/services/db-query-services/pg/db-whois.service';
import { Observable } from 'rxjs';

export {
  Timestamps,
  IpAddresses,
  Registrar,
  Contact,
  Dns,
  Ssl,
  Host,
  Valuation,
  Tag,
  Notification,
  Subdomain,
  Link,
};

export interface DomainExpiration {
  domain: string;
  expiration: Date;
}

export interface DbDomain extends Timestamps {
  id: string;
  user_id: string;
  domain_name: string;
  expiry_date?: Date;
  registration_date?: Date;
  updated_date?: Date;
  notes: string;
  ip_addresses?: { ip_address: string; is_ipv6: boolean }[];
  ssl?: Ssl;
  whois?: Contact;
  tags?: string[];
  host?: Host;
  registrar?: Registrar;
  dns: Dns;
  statuses?: SecurityCategory[];
  domain_costings?: Valuation;
  notification_preferences?: { notification_type: string; is_enabled: boolean }[];
  sub_domains?: Subdomain[];
  domain_links?: Link[];
}

export interface IpAddress extends Timestamps {
  id: string;
  domainId: string;
  ipAddress: string;
  isIpv6: boolean;
}

export interface NotificationOptions extends Timestamps {
  id: string;
  domainId: string;
  type: string;
  isEnabled: boolean;
}

export interface SaveDomainData {
  domain: Omit<
    DbDomain,
    'id' | 'user_id' | 'created_at' | 'updated_at' | 'dns' | 'ipAddresses'
  >;
  tags: string[];
  notifications: { type: string; isEnabled: boolean }[];
  statuses?: string[];
  ipAddresses?: { ipAddress: string; isIpv6: boolean }[];
  ssl?: Ssl;
  whois?: Contact;
  dns?: Dns;
  registrar?: Registrar;
  host?: Host;
  subdomains: { name: string; sd_info?: string }[];
  links?: Link[];
}

export abstract class DatabaseService {
  serviceType: 'supabase' | 'postgres' | 'none' | 'error' = 'none';

  notificationQueries!: SbNotificationQueries | PgNotificationQueries;
  linkQueries!: SbLinkQueries | PgLinkQueries;
  tagQueries!: SbTagQueries | PgTagQueries;
  historyQueries!: SbHistoryQueries | PgHistoryQueries;
  valuationQueries!: SbValuationQueries | PgValuationQueries;
  registrarQueries!: SbRegistrarQueries | PgRegistrarQueries;
  dnsQueries!: SbDnsQueries | PgDnsQueries;
  hostsQueries!: SbHostsQueries | PgHostsQueries;
  ipQueries!: SbIpQueries | PgIpQueries;
  sslQueries!: SbSslQueries | PgSslQueries;
  whoisQueries!: SbWhoisQueries | PgWhoisQueries;
  statusQueries!: SbStatusQueries | PgStatusQueries;
  subdomainsQueries!: SbSubdomainsQueries | PgSubdomainsQueries;

  abstract getDomainUptime(
    userId: string,
    domainId: string,
    timeframe: string,
  ): PromiseLike<unknown>;
  abstract listDomains(): Observable<DbDomain[]>;
  abstract domainExists(inputUserId: string | null, domainName: string): Promise<boolean>;
  abstract saveDomain(data: SaveDomainData): Observable<DbDomain>;
  abstract fetchAllForExport(
    domainNames: string,
    includeFields: string[] | { label: string; value: string }[],
  ): Observable<Record<string, unknown>[]>;
  abstract getDomainsByEppCodes(
    statuses: string[],
  ): Observable<Record<string, { domainId: string; domainName: string }[]>>;
  abstract getDomainExpirations(): Observable<DomainExpiration[]>;
  abstract deleteDomain(domainId: string): Observable<void>;
  abstract getAssetCount(assetType: string): Observable<number>;
  abstract listDomainNames(): Observable<string[]>;
  abstract getDomainsByStatus(statusCode: string): Observable<DbDomain[]>;
  abstract getStatusesWithDomainCounts(): Observable<
    { eppCode: string; description: string; domainCount: number }[]
  >;
  abstract getDomainsByTag(tagName: string): Observable<DbDomain[]>;
  abstract getDomainById(id: string): Promise<DbDomain>;
  abstract getDomain(domainName: string): Observable<DbDomain>;
  abstract updateDomain(
    domainId: string,
    domainData: SaveDomainData,
  ): Observable<DbDomain>;
  abstract checkAllTables(): Observable<
    { table: string; count: number | string; success: string }[]
  >;
  abstract deleteAllData(userId: string, tables?: string[]): Promise<void>;
  abstract getTotalDomains(): Observable<number>;
}

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * The database as both dialects see it. Column names and types match the
 * existing Postgres schema exactly, so established installs need no changes;
 * the SQLite DDL in migrations/ mirrors it with equivalent storage classes.
 */

/** Defaulted by the database on insert, and only touched to stamp a refresh */
type Timestamp = ColumnType<string, string | undefined, string | undefined>;

/** ISO date, kept as a YYYY-MM-DD string in both dialects */
type DateOnly = string;

export interface UsersTable {
  id: Generated<string>;
  email: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserInfoTable {
  id: Generated<string>;
  user_id: string | null;
  notification_channels: ColumnType<
    NotificationChannels | null,
    string | null,
    string | null
  >;
  current_plan: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface NotificationChannels {
  email?: { enabled?: boolean; address?: string };
  webhook?: { enabled?: boolean; url?: string; provider?: string };
  [channel: string]: unknown;
}

export interface DomainsTable {
  id: Generated<string>;
  user_id: string | null;
  domain_name: string;
  expiry_date: DateOnly | null;
  notes: string | null;
  registrar_id: string | null;
  registration_date: string | null;
  updated_date: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RegistrarsTable {
  id: Generated<string>;
  name: string;
  url: string | null;
  user_id: string | null;
}

export interface TagsTable {
  id: Generated<string>;
  name: string;
  color: string | null;
  description: string | null;
  icon: string | null;
  user_id: string | null;
}

export interface DomainTagsTable {
  domain_id: string;
  tag_id: string;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string | null;
  domain_id: string;
  change_type: string;
  message: string | null;
  sent: boolean;
  read: boolean;
  created_at: Timestamp;
}

export interface NotificationPreferencesTable {
  id: Generated<string>;
  domain_id: string;
  notification_type: string;
  is_enabled: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SslCertificatesTable {
  id: Generated<string>;
  domain_id: string;
  issuer: string | null;
  issuer_country: string | null;
  subject: string | null;
  valid_from: DateOnly | null;
  valid_to: DateOnly | null;
  fingerprint: string | null;
  key_size: number | null;
  signature_algorithm: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WhoisInfoTable {
  id: Generated<string>;
  domain_id: string;
  country: string | null;
  state: string | null;
  name: string | null;
  organization: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  created_at: Timestamp;
}

export interface DnsRecordsTable {
  id: Generated<string>;
  domain_id: string;
  record_type: string;
  record_value: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DomainCostingsTable {
  id: Generated<string>;
  domain_id: string;
  purchase_price: number | null;
  current_value: number | null;
  renewal_cost: number | null;
  auto_renew: boolean | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DomainStatusesTable {
  id: Generated<string>;
  domain_id: string;
  status_code: string;
  created_at: Timestamp;
}

export interface UptimeTable {
  id: Generated<string>;
  domain_id: string;
  checked_at: Timestamp;
  is_up: boolean;
  response_code: number | null;
  response_time_ms: number | null;
  dns_lookup_time_ms: number | null;
  ssl_handshake_time_ms: number | null;
}

export interface IpAddressesTable {
  id: Generated<string>;
  domain_id: string;
  ip_address: string;
  is_ipv6: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface HostsTable {
  id: Generated<string>;
  ip: string;
  lat: number | null;
  lon: number | null;
  isp: string | null;
  org: string | null;
  as_number: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  user_id: string | null;
}

export interface DomainHostsTable {
  domain_id: string;
  host_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DomainUpdatesTable {
  id: Generated<string>;
  domain_id: string;
  user_id: string | null;
  change: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  date: Timestamp;
}

export interface SubDomainsTable {
  id: Generated<string>;
  domain_id: string;
  name: string;
  sd_info: ColumnType<unknown, string | null, string | null>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DomainLinksTable {
  id: Generated<string>;
  domain_id: string;
  link_name: string;
  link_url: string;
  link_description: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BillingTable {
  id: Generated<string>;
  user_id: string | null;
  current_plan: string;
  next_payment_due: string | null;
  billing_method: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface JobRunsTable {
  name: string;
  started_at: string | null;
  finished_at: string | null;
  status: string | null;
  detail: string | null;
}

/** Bookkeeping for the migration runner, created before anything else */
export interface SchemaMigrationsTable {
  version: string;
  applied_at: Timestamp;
}

export interface Database {
  billing: BillingTable;
  dns_records: DnsRecordsTable;
  domain_costings: DomainCostingsTable;
  domain_hosts: DomainHostsTable;
  domain_links: DomainLinksTable;
  domain_statuses: DomainStatusesTable;
  domain_tags: DomainTagsTable;
  domain_updates: DomainUpdatesTable;
  domains: DomainsTable;
  hosts: HostsTable;
  ip_addresses: IpAddressesTable;
  job_runs: JobRunsTable;
  notification_preferences: NotificationPreferencesTable;
  notifications: NotificationsTable;
  registrars: RegistrarsTable;
  schema_migrations: SchemaMigrationsTable;
  ssl_certificates: SslCertificatesTable;
  sub_domains: SubDomainsTable;
  tags: TagsTable;
  uptime: UptimeTable;
  user_info: UserInfoTable;
  users: UsersTable;
  whois_info: WhoisInfoTable;
}

/** Runtime view of the table list, kept in step with Database by the check below */
export const TABLE_NAMES = [
  'billing',
  'dns_records',
  'domain_costings',
  'domain_hosts',
  'domain_links',
  'domain_statuses',
  'domain_tags',
  'domain_updates',
  'domains',
  'hosts',
  'ip_addresses',
  'job_runs',
  'notification_preferences',
  'notifications',
  'registrars',
  'schema_migrations',
  'ssl_certificates',
  'sub_domains',
  'tags',
  'uptime',
  'user_info',
  'users',
  'whois_info',
] as const;

// Fails to compile if TABLE_NAMES and Database ever disagree
const _tablesMatchSchema: Record<keyof Database, true> = Object.fromEntries(
  TABLE_NAMES.map((name) => [name, true]),
) as Record<(typeof TABLE_NAMES)[number], true>;
void _tablesMatchSchema;

export type Domain = Selectable<DomainsTable>;
export type NewDomain = Insertable<DomainsTable>;
export type DomainUpdate = Updateable<DomainsTable>;
export type Tag = Selectable<TagsTable>;
export type Registrar = Selectable<RegistrarsTable>;
export type Host = Selectable<HostsTable>;
export type Notification = Selectable<NotificationsTable>;

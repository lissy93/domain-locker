import { Observable, firstValueFrom, map } from 'rxjs';
import type { ApiClient } from './api-client';
import type {
  DbDomain,
  Host,
  Notification,
  Registrar,
  SaveDomainData,
  Tag,
} from '~/app/../types/Database';
import type { DomainCosting } from '~/app/services/db-query-services/sb/db-valuations.service';
import type { DomainUpdateRow } from '~/app/services/db-query-services/sb/db-history.service';
import type { NotificationChannels } from '~/types/common';
import type { LinkResponse, ModifiedLink } from '~/app/pages/assets/links/index.page';
import { makeEppArrayFromLabels } from '~/app/constants/security-categories';

/**
 * Query groups mirroring the Supabase services method for method, so the rest
 * of the app keeps calling the same names. Each is a thin wrapper over /v1.
 */

interface DomainPayload extends Omit<DbDomain, 'statuses'> {
  statusCodes?: string[];
}

/** EPP codes arrive raw, so the server stays free of UI concerns */
export function toDomain(payload: DomainPayload): DbDomain {
  const { statusCodes, ...rest } = payload;
  return { ...rest, statuses: makeEppArrayFromLabels(statusCodes ?? []) } as DbDomain;
}

function domainList(source: Observable<DomainPayload[]>): Observable<DbDomain[]> {
  return source.pipe(map((payloads) => payloads.map(toDomain)));
}

/**
 * Maps the UI's save shape onto what /v1/domains accepts. Fields the caller
 * never carried are left out entirely, so an edit form that only collects
 * notes cannot clear the columns it never showed.
 */
export function toSavePayload(data: SaveDomainData) {
  const domain = data.domain as SaveDomainData['domain'] & {
    registrar?: string | { name?: string; url?: string };
  };
  return withoutUndefined({
    domain: withoutUndefined({
      domain_name: domain.domain_name,
      expiry_date: toIsoDate(domain.expiry_date),
      registration_date: toIsoDate(domain.registration_date),
      updated_date: toIsoDate(domain.updated_date),
      notes: domain.notes,
      registrar: domain.registrar ?? data.registrar,
    }),
    tags: data.tags,
    notifications: data.notifications,
    statuses: data.statuses,
    ipAddresses: data.ipAddresses,
    ssl: data.ssl,
    whois: data.whois,
    dns: data.dns,
    host: data.host,
    subdomains: data.subdomains,
    links: data.links,
  });
}

/** undefined means "not carried", null means "clear this" */
function toIsoDate(value?: Date | string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function withoutUndefined<T extends object>(source: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export class ApiTagQueries {
  constructor(private api: ApiClient) {}

  getTags(): Observable<Tag[]> {
    return this.api.get<Tag[]>('/v1/tags');
  }

  getTag(tagName: string): Observable<Tag> {
    return this.api.get<Tag>(`/v1/tags/by-name/${encodeURIComponent(tagName)}`);
  }

  addTag(tag: Omit<Tag, 'id'>): Observable<Tag> {
    return this.api.post<Tag>('/v1/tags', tag);
  }

  createTag(tag: Tag): Observable<Tag> {
    return this.addTag(tag);
  }

  updateTag(tag: Tag): Observable<void> {
    return this.api.put<void>(`/v1/tags/${tag.id}`, tag).pipe(map(() => undefined));
  }

  deleteTag(id: string): Observable<void> {
    return this.api.delete<void>(`/v1/tags/${id}`).pipe(map(() => undefined));
  }

  getTagsWithDomainCounts(): Observable<(Tag & { domain_count: number })[]> {
    return this.api.get<(Tag & { domain_count: number })[]>('/v1/tags');
  }

  getDomainCountsByTag(): Observable<Record<string, number>> {
    return this.api.get<Record<string, number>>('/v1/tags/counts');
  }

  getDomainsForTag(
    tagId: string,
  ): Observable<{ available: Record<string, unknown>[]; selected: unknown[] }> {
    return this.api.get(`/v1/tags/${tagId}/domains`);
  }

  saveDomainsForTag(tagId: string, selectedDomains: { id: string }[]): Observable<void> {
    return this.api
      .put<void>(`/v1/tags/${tagId}/domains`, {
        domainIds: selectedDomains.map((domain) => domain.id),
      })
      .pipe(map(() => undefined));
  }
}

export class ApiNotificationQueries {
  constructor(private api: ApiClient) {}

  getNotificationPreferences(): Observable<
    { domain_id: string; notification_type: string; is_enabled: boolean }[]
  > {
    return this.api.get('/v1/notifications/preferences');
  }

  updateBulkNotificationPreferences(
    preferences: { domain_id: string; notification_type: string; is_enabled: boolean }[],
  ): Observable<void> {
    return this.api
      .put<void>('/v1/notifications/preferences', { preferences })
      .pipe(map(() => undefined));
  }

  getUserNotifications(
    limit = 25,
    offset = 0,
  ): Observable<{
    notifications: (Notification & { domain_name: string })[];
    total: number;
  }> {
    return this.api.get('/v1/notifications', { limit, offset });
  }

  markNotificationReadStatus(notificationId: string, read: boolean): Observable<void> {
    return this.api
      .put<void>(`/v1/notifications/${notificationId}/read`, { read })
      .pipe(map(() => undefined));
  }

  getUnreadNotificationCount(): Observable<number> {
    return this.api
      .get<{ total: number }>('/v1/notifications/unread-count')
      .pipe(map((response) => response.total));
  }

  async markAllNotificationsRead(read = true): Promise<Observable<void>> {
    return this.api
      .put<void>('/v1/notifications/read-all', { read })
      .pipe(map(() => undefined));
  }

  async getNotificationChannels(): Promise<NotificationChannels | null> {
    const response = await firstValueFrom(
      this.api.get<{ channels: NotificationChannels | null }>(
        '/v1/notifications/channels',
      ),
    );
    return response.channels;
  }

  async updateNotificationChannels(preferences: NotificationChannels): Promise<boolean> {
    await firstValueFrom(
      this.api.put('/v1/notifications/channels', { channels: preferences }),
    );
    return true;
  }
}

export class ApiLinkQueries {
  constructor(private api: ApiClient) {}

  getAllLinks(): Observable<LinkResponse> {
    return this.api.get<LinkResponse>('/v1/links');
  }

  addLinkToDomains(linkData: {
    link_name?: string;
    link_url?: string;
    link_description?: string;
    domains?: string[];
  }): Observable<void> {
    return this.api
      .post<void>('/v1/links', {
        link_name: linkData.link_name ?? '',
        link_url: linkData.link_url ?? '',
        link_description: linkData.link_description ?? null,
        domains: linkData.domains ?? [],
      })
      .pipe(map(() => undefined));
  }

  updateLinkInDomains(linkData: ModifiedLink): Observable<void> {
    return this.api
      .put<void>('/v1/links', {
        link_ids: linkData.link_ids ?? [],
        link_name: linkData.link_name ?? '',
        link_url: linkData.link_url ?? '',
        link_description: linkData.link_description ?? null,
        domains: linkData.domains ?? [],
      })
      .pipe(map(() => undefined));
  }

  deleteLinks(linkIds: string | string[]): Observable<void> {
    return this.api
      .delete<void>('/v1/links', {
        link_ids: Array.isArray(linkIds) ? linkIds : [linkIds],
      })
      .pipe(map(() => undefined));
  }
}

export interface HistoryEntry {
  date: string;
  added: number;
  removed: number;
  updated: number;
}

function historyFilters(
  domain?: string,
  category?: string,
  changeType?: string,
  search?: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ domain, category, changeType, search }).filter(
      ([, value]) => value,
    ) as [string, string][],
  );
}

export class ApiHistoryQueries {
  constructor(private api: ApiClient) {}

  getChangeHistory(domainName?: string, days = 7): Observable<HistoryEntry[]> {
    return this.api.get<HistoryEntry[]>(
      '/v1/history/summary',
      domainName ? { days, domain: domainName } : { days },
    );
  }

  getTotalUpdateCount(
    domainName?: string,
    category?: string,
    changeType?: string,
    search?: string,
  ): Observable<number> {
    return this.api
      .get<{
        total: number;
      }>('/v1/history/count', historyFilters(domainName, category, changeType, search))
      .pipe(map((response) => response.total));
  }

  getDomainUpdates(
    domainName?: string,
    start = 0,
    end = 24,
    category?: string,
    changeType?: string,
    search?: string,
  ): Observable<DomainUpdateRow[]> {
    return this.api.get<DomainUpdateRow[]>('/v1/history', {
      limit: Math.max(end - start + 1, 1),
      offset: start,
      ...historyFilters(domainName, category, changeType, search),
    });
  }
}

export class ApiValuationQueries {
  constructor(private api: ApiClient) {}

  getDomainCostings(): Observable<DomainCosting[]> {
    return this.api.get<DomainCosting[]>('/v1/assets/costings');
  }

  updateDomainCostings(updates: DomainCosting[]): Observable<void> {
    return this.api
      .put<void>('/v1/assets/costings', { updates })
      .pipe(map(() => undefined));
  }
}

export class ApiRegistrarQueries {
  constructor(private api: ApiClient) {}

  getRegistrars(): Observable<Registrar[]> {
    return this.api.get<Registrar[]>('/v1/assets/registrars');
  }

  getDomainCountsByRegistrar(): Observable<Record<string, number>> {
    return this.api.get('/v1/assets/registrars/counts');
  }

  getDomainsByRegistrar(registrarName: string): Observable<DbDomain[]> {
    return domainList(
      this.api.get<DomainPayload[]>(
        `/v1/assets/registrars/${encodeURIComponent(registrarName)}/domains`,
      ),
    );
  }
}

export class ApiHostsQueries {
  constructor(private api: ApiClient) {}

  getHosts(): Observable<Host[]> {
    return this.api.get<Host[]>('/v1/assets/hosts');
  }

  getHostsWithDomainCounts(): Observable<(Host & { domain_count: number })[]> {
    return this.api
      .get<(Host & { domains: string[] })[]>('/v1/assets/hosts')
      .pipe(
        map((hosts) =>
          hosts.map((host) => ({ ...host, domain_count: host.domains.length })),
        ),
      );
  }

  getDomainCountsByHost(): Observable<Record<string, number>> {
    return this.api.get('/v1/assets/hosts/counts');
  }

  getDomainsByHost(hostIsp: string): Observable<DbDomain[]> {
    return domainList(
      this.api.get<DomainPayload[]>(
        `/v1/assets/hosts/${encodeURIComponent(hostIsp)}/domains`,
      ),
    );
  }
}

export class ApiIpQueries {
  constructor(private api: ApiClient) {}

  getIpAddresses(
    isIpv6: boolean,
  ): Observable<{ ip_address: string; domains: string[] }[]> {
    return this.api.get('/v1/assets/ips', { ipv6: isIpv6 });
  }
}

export class ApiDnsQueries {
  constructor(private api: ApiClient) {}

  getDnsRecords(
    recordType: string,
  ): Observable<{ record_value: string; domains: string[] }[]> {
    return this.api.get('/v1/assets/dns', { type: recordType });
  }
}

export class ApiSslQueries {
  constructor(private api: ApiClient) {}

  getSslIssuersWithDomainCounts(): Observable<
    { issuer: string; domain_count: number }[]
  > {
    return this.api.get('/v1/assets/ssl-issuers');
  }

  getDomainsBySslIssuer(issuer: string): Observable<DbDomain[]> {
    return domainList(
      this.api.get<DomainPayload[]>(
        `/v1/assets/ssl-issuers/${encodeURIComponent(issuer)}/domains`,
      ),
    );
  }
}

export interface SubdomainRow {
  id?: string;
  name: string;
  sd_info?: string | null;
  domain_name?: string;
}

export class ApiSubdomainsQueries {
  constructor(private api: ApiClient) {}

  getAllSubdomains(): Observable<SubdomainRow[]> {
    return this.api.get<SubdomainRow[]>('/v1/subdomains');
  }

  getSubdomainsByDomain(domain: string): Observable<SubdomainRow[]> {
    return this.api.get<SubdomainRow[]>(`/v1/subdomains/${encodeURIComponent(domain)}`);
  }

  getSubdomainInfo(domain: string, subdomain: string): Observable<SubdomainRow | null> {
    return this.api.get<SubdomainRow | null>(
      `/v1/subdomains/${encodeURIComponent(domain)}/${encodeURIComponent(subdomain)}`,
    );
  }

  saveSubdomainsForDomainName(
    domain: string,
    subdomains: { name: string; sd_info?: unknown }[],
  ): Observable<void> {
    return this.api
      .put<void>(`/v1/subdomains/${encodeURIComponent(domain)}`, { subdomains })
      .pipe(map(() => undefined));
  }

  saveSubdomainForDomain(domainName: string, subdomain: string): Observable<void> {
    return this.api
      .post<void>(`/v1/subdomains/${encodeURIComponent(domainName)}`, {
        name: subdomain,
      })
      .pipe(map(() => undefined));
  }

  deleteSubdomain(domain: string, subdomain: string): Observable<void> {
    return this.api
      .delete<void>(
        `/v1/subdomains/${encodeURIComponent(domain)}/${encodeURIComponent(subdomain)}`,
      )
      .pipe(map(() => undefined));
  }
}

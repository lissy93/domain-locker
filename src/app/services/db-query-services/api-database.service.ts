import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, throwError } from 'rxjs';
import {
  DatabaseService,
  DbDomain,
  DomainExpiration,
  SaveDomainData,
  UptimeRow,
} from '~/app/../types/Database';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { ApiClient } from './api/api-client';
import {
  ApiDnsQueries,
  ApiHistoryQueries,
  ApiHostsQueries,
  ApiIpQueries,
  ApiLinkQueries,
  ApiNotificationQueries,
  ApiRegistrarQueries,
  ApiSslQueries,
  ApiSubdomainsQueries,
  ApiTagQueries,
  ApiValuationQueries,
  toDomain,
  toSavePayload,
} from './api/api-queries';

/** Shape the /v1 endpoints return, before EPP codes become security categories */
interface DomainPayload extends Omit<DbDomain, 'statuses'> {
  statusCodes?: string[];
}

/**
 * Self-hosted data access. Every call is a request to the server's /v1 API,
 * so no credentials or SQL ever reach the browser.
 */
@Injectable({ providedIn: 'root' })
export default class ApiDatabaseService extends DatabaseService {
  private api = inject(ApiClient);
  private errorHandler = inject(ErrorHandlerService);

  constructor() {
    super();
    this.tagQueries = new ApiTagQueries(this.api);
    this.notificationQueries = new ApiNotificationQueries(this.api);
    this.linkQueries = new ApiLinkQueries(this.api);
    this.historyQueries = new ApiHistoryQueries(this.api);
    this.valuationQueries = new ApiValuationQueries(this.api);
    this.registrarQueries = new ApiRegistrarQueries(this.api);
    this.dnsQueries = new ApiDnsQueries(this.api);
    this.hostsQueries = new ApiHostsQueries(this.api);
    this.ipQueries = new ApiIpQueries(this.api);
    this.sslQueries = new ApiSslQueries(this.api);
    this.subdomainsQueries = new ApiSubdomainsQueries(this.api);
  }

  private fail(error: unknown): Observable<never> {
    this.errorHandler.handleError({
      error,
      message: (error as Error)?.message || 'Request to the Domain Locker API failed',
      location: 'api-database.service',
      showToast: false,
    });
    return throwError(() => error);
  }

  private domains(path: string, params?: Record<string, string>): Observable<DbDomain[]> {
    return this.api.get<DomainPayload[]>(path, params).pipe(
      map((payloads) => payloads.map(toDomain)),
      catchError((error) => this.fail(error)),
    );
  }

  listDomains(): Observable<DbDomain[]> {
    return this.domains('/v1/domains');
  }

  listDomainNames(): Observable<string[]> {
    return this.api
      .get<string[]>('/v1/domains/names')
      .pipe(catchError((error) => this.fail(error)));
  }

  getDomain(domainName: string): Observable<DbDomain> {
    return this.api
      .get<DomainPayload>(`/v1/domains/by-name/${encodeURIComponent(domainName)}`)
      .pipe(
        map(toDomain),
        catchError((error) => this.fail(error)),
      );
  }

  async getDomainById(id: string): Promise<DbDomain> {
    const payload = await this.promise(this.api.get<DomainPayload>(`/v1/domains/${id}`));
    return toDomain(payload);
  }

  async domainExists(_userId: string | null, domainName: string): Promise<boolean> {
    const names = await this.promise(this.api.get<string[]>('/v1/domains/names'));
    return names.includes(domainName.toLowerCase());
  }

  saveDomain(data: SaveDomainData): Observable<DbDomain> {
    return this.api.post<DomainPayload>('/v1/domains', toSavePayload(data)).pipe(
      map(toDomain),
      catchError((error) => this.fail(error)),
    );
  }

  updateDomain(domainId: string, data: SaveDomainData): Observable<DbDomain> {
    return this.api
      .put<DomainPayload>(`/v1/domains/${domainId}`, toSavePayload(data))
      .pipe(
        map(toDomain),
        catchError((error) => this.fail(error)),
      );
  }

  deleteDomain(domainId: string): Observable<void> {
    return this.api.delete<void>(`/v1/domains/${domainId}`).pipe(
      map(() => undefined),
      catchError((error) => this.fail(error)),
    );
  }

  getDomainsByTag(tagName: string): Observable<DbDomain[]> {
    return this.domains(`/v1/domains/by-tag/${encodeURIComponent(tagName)}`);
  }

  getDomainsByStatus(statusCode: string): Observable<DbDomain[]> {
    return this.domains(`/v1/domains/by-status/${encodeURIComponent(statusCode)}`);
  }

  getDomainExpirations(): Observable<DomainExpiration[]> {
    return this.api
      .get<{ domain: string; expiration: string | null }[]>('/v1/domains/expirations')
      .pipe(
        map((rows) =>
          rows.map((row) => ({
            domain: row.domain,
            expiration: row.expiration ? new Date(row.expiration) : new Date(0),
          })),
        ),
        catchError((error) => this.fail(error)),
      );
  }

  getTotalDomains(): Observable<number> {
    return this.api.get<{ total: number }>('/v1/domains/count').pipe(
      map((response) => response.total),
      catchError((error) => this.fail(error)),
    );
  }

  getAssetCount(assetType: string): Observable<number> {
    return this.api.get<{ total: number }>('/v1/assets/counts', { type: assetType }).pipe(
      map((response) => response.total),
      catchError((error) => this.fail(error)),
    );
  }

  getStatusesWithDomainCounts(): Observable<
    { eppCode: string; description: string; domainCount: number }[]
  > {
    return this.api
      .get<{ eppCode: string; domainCount: number }[]>('/v1/domains/statuses')
      .pipe(
        map((rows) => rows.map((row) => ({ ...row, description: '' }))),
        catchError((error) => this.fail(error)),
      );
  }

  getDomainsByEppCodes(
    statuses: string[],
  ): Observable<Record<string, { domainId: string; domainName: string }[]>> {
    return this.api
      .post<
        Record<string, { domainId: string; domainName: string }[]>
      >('/v1/domains/by-epp-codes', { statuses })
      .pipe(catchError((error) => this.fail(error)));
  }

  getDomainUptime(
    _userId: string,
    domainId: string,
    timeframe: string,
  ): Promise<UptimeRow[]> {
    return this.promise(
      this.api.get<UptimeRow[]>(`/v1/domains/${domainId}/uptime`, { timeframe }),
    );
  }

  override getDomainUptimeBatch(
    domainIds: string[],
    timeframe: string,
  ): Promise<Record<string, UptimeRow[]>> {
    return this.promise(
      this.api.post<Record<string, UptimeRow[]>>('/v1/uptime/history', {
        domainIds,
        timeframe,
      }),
    );
  }

  getDomainUptimeDaily(
    _userId: string,
    domainId: string,
    days: number,
  ): Promise<{ day: string; avg_response_time_ms: number | null }[]> {
    return this.promise(
      this.api.get<{ day: string; avg_response_time_ms: number | null }[]>(
        `/v1/domains/${domainId}/uptime-daily`,
        { days },
      ),
    );
  }

  fetchAllForExport(domainNames: string): Observable<Record<string, unknown>[]> {
    return this.api
      .get<
        Record<string, unknown>[]
      >('/v1/export', domainNames ? { domains: domainNames } : undefined)
      .pipe(catchError((error) => this.fail(error)));
  }

  checkAllTables(): Observable<
    { table: string; count: number | string; success: string }[]
  > {
    return this.api
      .get<
        { table: string; count: number | null; success: boolean }[]
      >('/v1/admin/tables')
      .pipe(
        map((rows) =>
          rows.map((row) => ({
            table: row.table,
            count: row.count ?? 'error',
            success: row.success ? 'Success' : 'Failed',
          })),
        ),
        catchError((error) => this.fail(error)),
      );
  }

  async deleteAllData(_userId: string, tables?: string[]): Promise<void> {
    await this.promise(this.api.post('/v1/admin/delete-data', { tables }));
  }

  private promise<T>(source: Observable<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      source.subscribe({ next: resolve, error: reject });
    }).catch((error) => {
      this.errorHandler.handleError({
        error,
        message: (error as Error)?.message || 'Request to the Domain Locker API failed',
        location: 'api-database.service',
        showToast: false,
      });
      throw error;
    });
  }
}

export { from };

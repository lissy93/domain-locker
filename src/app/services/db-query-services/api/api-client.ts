import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { REQUEST } from '@analogjs/router/tokens';
import { Observable, catchError, map, throwError } from 'rxjs';

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/** A failure the API reported, carrying its stable code for callers to branch on */
export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Talks to the server's /v1 API. Every data call in self-hosted mode goes
 * through here, so credentials and SQL stay on the server.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private http = inject(HttpClient);
  private platformId = inject<object>(PLATFORM_ID);
  private request = inject(REQUEST, { optional: true });

  get<T>(path: string, params?: Record<string, string | number | boolean>) {
    return this.send<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown) {
    return this.send<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.send<T>('PUT', path, body);
  }

  delete<T>(path: string, body?: unknown) {
    return this.send<T>('DELETE', path, body);
  }

  private send<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean>,
  ): Observable<T> {
    return this.http
      .request<T>(method, `${this.baseUrl()}${path}`, {
        body,
        params: params ? new HttpParams({ fromObject: params }) : undefined,
        headers: this.forwardedHeaders(),
        withCredentials: true,
      })
      .pipe(
        map((response) => response as T),
        catchError((error: HttpErrorResponse) => throwError(() => toApiError(error))),
      );
  }

  /**
   * Rendering happens in a fresh context with no cookies of its own, so the
   * visitor's session is passed along. Without it a password-protected instance
   * renders every page empty and only fills in once the browser takes over.
   */
  private forwardedHeaders(): Record<string, string> | undefined {
    if (isPlatformBrowser(this.platformId)) return undefined;
    const cookie = this.request?.headers?.['cookie'];
    return cookie ? { cookie } : undefined;
  }

  /**
   * The browser always calls the page's own origin, since the API is served by
   * the same app. Anything absolute would be cross-origin and blocked. Server
   * rendering has no origin of its own, so it goes over the loopback.
   */
  private baseUrl(): string {
    if (isPlatformBrowser(this.platformId)) return '';
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env;
    if (env?.['DL_INTERNAL_BASE_URL']) return env['DL_INTERNAL_BASE_URL'];

    const host = this.request?.headers?.['host'];
    if (env?.['NODE_ENV'] === 'development' && host) {
      return `http://${host.replace(/^0\.0\.0\.0/, '127.0.0.1')}`;
    }
    return `http://localhost:${env?.['NITRO_PORT'] || env?.['PORT'] || '3000'}`;
  }
}

function toApiError(error: HttpErrorResponse): ApiRequestError {
  const body = error.error as ApiErrorBody | string | null;
  if (body && typeof body === 'object' && body.error) {
    return new ApiRequestError(
      body.error.code ?? 'internal',
      body.error.message ?? 'Request failed',
      body.error.details,
    );
  }
  return new ApiRequestError(
    error.status === 0 ? 'unreachable' : 'internal',
    error.status === 0
      ? 'Could not reach the Domain Locker server'
      : `Request failed with status ${error.status}`,
  );
}

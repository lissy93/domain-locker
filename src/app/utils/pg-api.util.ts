import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { EnvService } from '~/app/services/environment.service';

interface PgCredentials {
  host: string | null;
  port?: string | null;
  user?: string | null;
  password?: string | null;
  database?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PgApiUtilService {
  private http = inject(HttpClient);
  private envService = inject(EnvService);
  private platformId = inject<object>(PLATFORM_ID);

  private baseUrl: string; // e.g. 'http://localhost:5173/api/pg-executer/'

  constructor() {
    // Build the base URL from your environment or fallback
    this.baseUrl = this.envService.getPostgresApiUrl();
  }

  /**
   * Posts a query to the Postgres executor API, passing user credentials from local storage if found.
   * If no local credentials found, server will rely on environment variables.
   */
  postToPgExecutor<T>(query: string, params?: unknown[]): Observable<{ data: T[] }> {
    let creds: PgCredentials | undefined = undefined;

    if (isPlatformBrowser(this.platformId)) {
      const host = localStorage.getItem('DL_PG_HOST');
      const port = localStorage.getItem('DL_PG_PORT');
      const user = localStorage.getItem('DL_PG_USER');
      const password = localStorage.getItem('DL_PG_PASSWORD');
      const database = localStorage.getItem('DL_PG_NAME');

      // If user has set some or all of these, we pass them in the request body
      if (host || port || user || password || database) {
        creds = { host, port, user, password, database };
      }
    }

    const body = {
      query,
      params: params || [],
      credentials: creds,
    };

    return this.http.post<{ data: T[] }>(this.baseUrl, body);
  }
}

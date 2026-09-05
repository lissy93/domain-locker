import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, isObservable, shareReplay, tap, throwError } from 'rxjs';
import { EnvService } from '~/app/services/environment.service';
import SbDatabaseService from '~/app/services/db-query-services/sb-database.service';
import ApiDatabaseService from '~/app/services/db-query-services/api-database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { DOMAIN_WRITE_METHODS } from '~/app/constants/write-methods';
import {
  type DatabaseService as IDatabaseService,
  type DbDomain,
} from '~/app/../types/Database';

@Injectable({
  providedIn: 'root',
})
export default class DatabaseService {
  private envService = inject(EnvService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);

  private service!: IDatabaseService;
  private domainsCache: Observable<DbDomain[]> | null = null;
  public serviceType: 'supabase' | 'postgres' | 'none' | 'error' = 'none';

  constructor() {
    if (this.envService.isSelfHostedDatabase()) {
      this.service = this.watchForWrites(
        inject(ApiDatabaseService) as unknown as IDatabaseService,
      );
      this.serviceType = 'postgres';
    } else if (this.envService.isSupabaseEnabled()) {
      try {
        this.serviceType = 'supabase';
        this.service = this.watchForWrites(
          inject(SbDatabaseService) as unknown as IDatabaseService,
        );
      } catch (e) {
        this.errorHappened('Failed to establish connection to Supabase', e as Error);
      }
    } else {
      this.errorHappened('No database service is enabled');
    }
  }

  public errorHappened(errorMessage: string, error?: Error) {
    this.errorHandler.handleError({
      message: errorMessage,
      showToast: true,
      error,
      location: 'DatabaseService.constructor',
    });
    this.serviceType = 'error';
    this.service = {} as unknown as IDatabaseService;
    this.router.navigate(['/advanced/error'], { queryParams: { errorMessage } });
  }

  // Expose the proxied service to the rest of the app
  public get instance(): IDatabaseService {
    return this.service;
  }

  /**
   * The domain list, fetched once and shared. Most pages need the same data,
   * so this replaces a fetch per page with a fetch per change.
   */
  public get domains$(): Observable<DbDomain[]> {
    this.domainsCache ??= this.service.listDomains().pipe(
      catchError((error: unknown) => {
        this.invalidateDomains();
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.domainsCache;
  }

  public invalidateDomains(): void {
    this.domainsCache = null;
  }

  /** Clears the cached domain list once a write finishes */
  private watchForWrites<T extends object>(service: T): T {
    const groups = new Map<string, object>();
    return new Proxy(service, {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);
        const name = String(property);

        if (name.endsWith('Queries') && value && typeof value === 'object') {
          const wrapped = groups.get(name) ?? this.watchForWrites(value as object);
          groups.set(name, wrapped);
          return wrapped;
        }

        if (typeof value !== 'function' || !DOMAIN_WRITE_METHODS.has(name)) return value;
        return (...args: unknown[]) =>
          this.invalidateOnceSettled(
            (value as (...a: unknown[]) => unknown).apply(target, args),
          );
      },
    });
  }

  /** Writes return either an Observable or a Promise, so handle both */
  private invalidateOnceSettled(result: unknown): unknown {
    const invalidate = () => this.invalidateDomains();
    if (isObservable(result)) {
      return result.pipe(
        tap({ next: invalidate, complete: invalidate, error: invalidate }),
      );
    }
    if (result instanceof Promise) return result.finally(invalidate);
    invalidate();
    return result;
  }
}

import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, shareReplay } from 'rxjs';
import { EnvService } from '~/app/services/environment.service';
import SbDatabaseService from '~/app/services/db-query-services/sb-database.service';
import ApiDatabaseService from '~/app/services/db-query-services/api-database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import {
  type DatabaseService as IDatabaseService,
  type DbDomain,
} from '~/app/../types/Database';

/** Anything that can change the domain list, so the cache is dropped after it */
const DOMAIN_MUTATIONS = new Set([
  'saveDomain',
  'updateDomain',
  'deleteDomain',
  'deleteAllData',
]);

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
    this.domainsCache ??= this.service
      .listDomains()
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.domainsCache;
  }

  public invalidateDomains(): void {
    this.domainsCache = null;
  }

  /** Clears the cached list whenever something writes through the service */
  private watchForWrites(service: IDatabaseService): IDatabaseService {
    return new Proxy(service, {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== 'function' || !DOMAIN_MUTATIONS.has(String(property))) {
          return value;
        }
        return (...args: unknown[]) => {
          this.invalidateDomains();
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    });
  }
}

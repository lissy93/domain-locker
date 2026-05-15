import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EnvService } from '~/app/services/environment.service';
import SbDatabaseService from '~/app/services/db-query-services/sb-database.service';
import PgDatabaseService from '~/app/services/db-query-services/pg-database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { type DatabaseService as IDatabaseService } from '~/app/../types/Database';

@Injectable({
  providedIn: 'root',
})
export default class DatabaseService {
  private envService = inject(EnvService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);

  private service!: IDatabaseService;
  public serviceType: 'supabase' | 'postgres' | 'none' | 'error' = 'none';

  constructor() {
    if (this.envService.isPostgresEnabled()) {
      this.service = inject(PgDatabaseService) as unknown as IDatabaseService;
      this.serviceType = 'postgres';
    } else if (this.envService.isSupabaseEnabled()) {
      try {
        this.serviceType = 'supabase';
        this.service = inject(SbDatabaseService) as unknown as IDatabaseService;
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
}

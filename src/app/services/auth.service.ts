import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map, type Observable } from 'rxjs';
import { ApiClient } from '~/app/services/db-query-services/api/api-client';
import { EnvService } from '~/app/services/environment.service';
import { SupabaseService } from '~/app/services/supabase.service';

export interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
}

/**
 * Sign-in for self-hosted instances, which use a single instance password set
 * with DL_AUTH_PASSWORD. Without one the instance stays open, which is the
 * zero-config default. Sign-out covers both deployment modes.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiClient);
  private envService = inject(EnvService);
  private supabaseService = inject(SupabaseService);

  // Derived from an env var, so it cannot change while the app is running
  private authRequired?: boolean;

  async status(): Promise<AuthStatus> {
    const status = await firstValueFrom(this.api.get<AuthStatus>('/v1/auth/status'));
    this.authRequired = status.authRequired;
    return status;
  }

  /** True when this instance has no password, or the visitor has signed in */
  async isAuthenticated(): Promise<boolean> {
    if (this.authRequired === false) return true;
    const status = await this.status();
    return !status.authRequired || status.authenticated;
  }

  login(password: string): Observable<void> {
    return this.api
      .post<AuthStatus>('/v1/auth/login', { password })
      .pipe(map(() => undefined));
  }

  async signOut(): Promise<void> {
    if (this.envService.isSupabaseEnabled()) {
      await this.supabaseService.signOut();
      return;
    }
    await firstValueFrom(this.api.post<AuthStatus>('/v1/auth/logout'));
  }
}

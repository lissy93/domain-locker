import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '~/app/services/environment.service';
import { ErrorHandlerService } from '../services/error-handler.service';

interface EnvResponse {
  error?: string;
  env?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class EnvLoaderService {
  private http = inject(HttpClient);
  private envService = inject(EnvService);
  private errorHandler = inject(ErrorHandlerService);
  private platformId = inject(PLATFORM_ID);

  private isLoaded = false;

  async loadEnv(): Promise<void> {
    // Abort if not running client-side
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Managed is configured at build time, any other build asks the server
    if (this.envService.getEnvVar('DL_ENV_TYPE') === 'managed') {
      return;
    }

    // Return early if already loaded values
    if (this.isLoaded) {
      return;
    }

    try {
      const response = await firstValueFrom(this.http.get<EnvResponse>('/api/env-var'));

      // A refusal means the server isn't self-hosted, so there's nothing to apply
      if (!response || response.error || !response.env) {
        return;
      }

      const envVars = response.env;
      const windowWithEnv = window as unknown as { __env?: Record<string, string> };
      const windowEnv = windowWithEnv.__env ?? {};

      // The server is authoritative, so its values replace anything baked in
      Object.assign(windowEnv, envVars);

      // Then update the window.__env object, and mark as loaded
      windowWithEnv.__env = windowEnv;
      this.isLoaded = true;
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to load environment variables',
        location: 'EvnLoader',
        showToast: true,
      });
    }
  }
}

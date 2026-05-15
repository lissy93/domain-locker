import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { EnvService, EnvVar } from '~/app/services/environment.service';
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

    // Also abort if is not self-hosted (as this is only needed in Docker)
    const dlEnvType = this.envService.getEnvVar('DL_ENV_TYPE');
    if (dlEnvType && dlEnvType !== 'selfHosted') {
      return;
    }

    // Return early if already loaded values
    if (this.isLoaded) {
      return;
    }

    try {
      const response = await firstValueFrom(this.http.get<EnvResponse>('/api/env-var'));

      if (!response || response.error) {
        this.errorHandler.handleError({
          error: response?.error,
          message: 'Failed to load environment variables',
          location: 'EnvLoader',
        });
        return;
      }
      if (!response.env) {
        this.errorHandler.handleError({
          error: response?.error,
          message: '/api/env did not return "env" object',
          location: 'EnvLoader',
        });
        return;
      }

      const envVars = response.env;
      const windowWithEnv = window as unknown as { __env?: Record<string, string> };
      const windowEnv = windowWithEnv.__env ?? {};

      // Set each variable which isn't already set
      for (const [key, value] of Object.entries(envVars)) {
        const currentVal = this.envService.getEnvVar(key as EnvVar);
        if (currentVal) {
          continue;
        }
        windowEnv[key] = value;
      }

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

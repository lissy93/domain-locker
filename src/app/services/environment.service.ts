import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { REQUEST } from '@angular/core';
import { environment } from '~/app/environments/environment';

export type EnvironmentType = 'dev' | 'managed' | 'selfHosted' | 'demo';

export type EnvVar =
  | 'DL_BASE_URL' // Hostname/URL or HOST:PORT where domain locker is running
  | 'SUPABASE_URL' // Supabase URL
  | 'SUPABASE_ANON_KEY' // Supabase public key
  | 'DL_ENV_TYPE' // EnvironmentType (dev, managed, selfHosted, demo)
  | 'DL_SUPABASE_PROJECT' // Supabase project ID
  | 'DL_DEBUG' // Enable debug mode, to show debug messages
  | 'DL_GLITCHTIP_DSN' // GlitchTip DSN, for error tracking
  | 'DL_PLAUSIBLE_URL' // URL to Plausible instance, for hit counting
  | 'DL_PLAUSIBLE_SITE' // Plausible site ID /  URL, for hit counting
  | 'DL_TURNSTILE_KEY' // Cloudflare public site key for Turnstile captcha
  | 'DL_PG_HOST' // Postgres host
  | 'DL_PG_PORT' // Postgres port
  | 'DL_PG_NAME' // Postgres DB name
  | 'DL_PG_USER' // Postgres user
  | 'DL_PG_PASSWORD' // Postgres password
  | 'DL_DEMO_USER' // Demo user email (for auto-filling on demo instance)
  | 'DL_DEMO_PASS' // Demo user password (for auto-filling on demo instance)
  | 'DL_DOMAIN_INFO_API' // API endpoint for /api/domain-info
  | 'DL_DOMAIN_SUBS_API' // API endpoint for /api/domain-subs
  | 'DL_STRIPE_CHECKOUT_URL' // Endpoint for creating a Stripe Checkout session
  | 'DL_STRIPE_CANCEL_URL' // Endpoint for cancelling subscription, + refunding via Stripe
  | 'DL_STRIPE_INFO_URL' // Endpoint for getting user's Stripe subscription info
  | 'DL_DISABLE_WRITE_METHODS'; // Disable write methods (only used for demo instance)

@Injectable({
  providedIn: 'root',
})
export class EnvService {
  private platformId = inject<object>(PLATFORM_ID);

  private environmentFile = (environment || {}) as Record<string, string | undefined>;

  mapKeyToVarName(key: EnvVar): string {
    return key.startsWith('DL_') ? key.substring(3) : key;
  }

  /**
   * Retrieves the value of an environment variable
   * Tries environmental variable (e.g. from .env) first, then runtime variable (e.g. from environment.ts)
   * Otherwise returns the fallback value if present, otherwise null.
   * @param key Environment variable key
   * @param fallback Fallback value
   */
  getEnvVar(
    key: EnvVar,
    fallback: string | null = null,
    throwError = false,
  ): string | null {
    // Build-time environmental variable (e.g. from .env)
    const buildtimeValue =
      import.meta.env[key] || this.environmentFile[this.mapKeyToVarName(key)];
    // Runtime variable (e.g. passed at runtime, on self-hosted instances)
    const runtimeValue =
      isPlatformBrowser(this.platformId) && typeof window !== 'undefined'
        ? (window as unknown as { __env?: Record<string, string> }).__env?.[key]
        : null;
    // Local value (only if not managed instance)
    const localStorageValue =
      import.meta.env['DL_ENV_TYPE'] !== 'managed'
        ? this.getValueFromLocalStorage(key)
        : null;

    // Pick value, based on priority or use fallback
    const value = (localStorageValue || buildtimeValue || runtimeValue) ?? fallback;

    // If nothing, and unexpected, throw error to be caught by the caller
    if (!value && throwError) {
      throw new Error(`Environment variable ${key} is not set.`);
    }
    return value;
  }

  /**
   * Checks if Supabase is enabled in the environment, but without throwing an error.
   * @returns
   */
  isSupabaseEnabled(): boolean {
    const supabaseUrl = this.getEnvVar('SUPABASE_URL');
    const supabaseKey = this.getEnvVar('SUPABASE_ANON_KEY');
    return Boolean(supabaseUrl && supabaseKey);
  }

  isPostgresEnabled(): boolean {
    if (this.getEnvironmentType() === 'managed') return false;
    const { host, port, user, password, database } = this.getPostgresConfig();
    return Boolean(host && port && user && password && database);
  }

  /**
   * Determines the environment type.
   */
  getEnvironmentType(): EnvironmentType {
    const env = this.getEnvVar('DL_ENV_TYPE', 'selfHosted');
    if (env && ['dev', 'managed', 'selfHosted', 'demo'].includes(env)) {
      return env as EnvironmentType;
    }
    return 'selfHosted';
  }

  /**
   * Returns the Supabase URL from the environment.
   */
  getSupabaseUrl(): string {
    return this.getEnvVar('SUPABASE_URL', null, true) as string;
  }

  /**
   * Returns the Supabase public key from the environment.
   */
  getSupabasePublicKey(): string {
    return this.getEnvVar('SUPABASE_ANON_KEY', null, true) as string;
  }

  getProjectId(): string | null {
    return this.getEnvVar('DL_SUPABASE_PROJECT');
  }

  getGlitchTipDsn(): string | null {
    return this.getEnvVar('DL_GLITCHTIP_DSN');
  }

  /* Returns config object for Postgres */
  getPostgresConfig(): {
    host: string | null;
    port: number;
    user: string | null;
    password: string | null;
    database: string | null;
  } {
    return {
      host: this.getEnvVar('DL_PG_HOST'),
      port: Number(this.getEnvVar('DL_PG_PORT')),
      user: this.getEnvVar('DL_PG_USER'),
      password: this.getEnvVar('DL_PG_PASSWORD'),
      database: this.getEnvVar('DL_PG_NAME'),
    };
  }

  getBaseUrl(): string {
    // If user has explicitly set DL_BASE_URL, always respect it
    const envBase = this.getEnvVar('DL_BASE_URL', '');
    if (envBase) {
      return envBase;
    }

    // Otherwise, detect from runtime context

    // Use current location for browser environments
    if (isPlatformBrowser(this.platformId)) {
      if (window.location.origin) return window.location.origin;
    }

    // For SSR (server-side rendering), detect from HTTP request context
    try {
      const request = inject(REQUEST, { optional: true }) as {
        headers?: Record<string, string>;
      } | null;

      if (request?.headers) {
        // Check for reverse proxy headers first
        const forwardedProto =
          request.headers['x-forwarded-proto'] ||
          (request.headers['x-forwarded-ssl'] === 'on' ? 'https' : null);
        const forwardedHost =
          request.headers['x-forwarded-host'] || request.headers['host'];

        if (forwardedHost) {
          const protocol = forwardedProto || 'http';
          return `${protocol}://${forwardedHost}`;
        }
      }
    } catch {
      // REQUEST token not available (not in SSR context)
    }

    // Fallback to relative paths (SSR will handle this)
    return '/';
  }

  getPostgresApiUrl(): string {
    const endpoint = '/api/pg-executer/';
    const baseUrl = this.getBaseUrl();
    return `${baseUrl}${endpoint}`;
  }

  getPlausibleConfig(): { site: string; url: string; isConfigured: boolean } {
    const site = this.getEnvVar('DL_PLAUSIBLE_SITE', '') || '';
    const url = this.getEnvVar('DL_PLAUSIBLE_URL', '') || '';
    const isConfigured = Boolean(site && url);
    return { site, url, isConfigured };
  }

  getValueFromLocalStorage(key: string): string | null {
    if (isPlatformBrowser(this.platformId) && localStorage) {
      return localStorage.getItem(key) || null;
    }
    return null;
  }

  checkAllEnvironmentalVariables(): { envName: EnvVar; hasValue: boolean }[] {
    return (Object.keys(import.meta.env) as EnvVar[]).map((envName) => ({
      envName,
      hasValue: Boolean(this.getEnvVar(envName)),
    }));
  }
}

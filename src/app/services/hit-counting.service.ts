/**
 * HitCountingService - This uses a self-hosted instance of Plausible, to record
 * certain events within the application.
 * So that we can measure engagement so we can understand which features are most used,
 * and improve accordingly.
 * No personal data is collected, and no cookies are used.
 *
 * All tracking will be skipped if:
 * - The user has disabled analytics in the settings.
 * - The user is not using the public managed instance.
 * - The app is not running in the browser.
 * - The browser has DNT enabled, or an ad-blocker.
 * - The environmental variable to enable Plausible is not set.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EnvService } from '~/app/services/environment.service';
import { SupabaseService } from '~/app/services/supabase.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

type EventType =
  | 'pageview_authenticated'
  | 'pageview_unauthenticated'
  | 'auth_view'
  | 'auth_login_start'
  | 'auth_login_done'
  | 'auth_logout'
  | 'auth_password_reset_start'
  | 'auth_signup_start'
  | 'auth_signup_done'
  | 'add_domain';

@Injectable({
  providedIn: 'root',
})
export class HitCountingService {
  private platformId = inject<object>(PLATFORM_ID);
  private envService = inject(EnvService);
  private supabaseService = inject(SupabaseService);
  private errorHandler = inject(ErrorHandlerService);

  private plausibleEnabled = false;
  private analyticsKey = 'PRIVACY_disable-analytics';

  private get plausibleWindow(): {
    plausible?: (event: string, opts?: { props?: Record<string, unknown> }) => void;
  } {
    return window as unknown as {
      plausible?: (event: string, opts?: { props?: Record<string, unknown> }) => void;
    };
  }

  constructor() {
    this.plausibleEnabled = this.shouldEnablePlausible();
    if (this.plausibleEnabled) {
      this.initializePlausible();
    }
  }

  /* Read Plausible config from environmental variables */
  private getCredentials() {
    const {
      site: plausibleSite,
      url: plausibleUrl,
      isConfigured,
    } = this.envService.getPlausibleConfig();
    return { plausibleUrl, plausibleSite, isConfigured };
  }

  /* Checks if Plausible analytics should be enabled */
  private shouldEnablePlausible(): boolean {
    // Ensure we are running in the browser environment
    if (!isPlatformBrowser(this.platformId)) return false;

    // Check for required environment variables
    const { isConfigured } = this.getCredentials();
    const analyticsDisabled = localStorage.getItem(this.analyticsKey) === 'true';

    // Return false if user disabled, admin disabled or any missing values
    if (!isConfigured || analyticsDisabled) {
      return false;
    }

    return true;
  }

  /* Initializes Plausible Analytics */
  private initializePlausible(): void {
    const { plausibleUrl, plausibleSite } = this.getCredentials();

    // Insert the Plausible script into the document head
    const script = document.createElement('script');
    script.setAttribute('async', 'true');
    script.setAttribute('defer', 'true');
    script.setAttribute('data-domain', plausibleSite as string);
    script.src = `${plausibleUrl}/js/plausible.js`;
    document.head.appendChild(script);
  }

  /* Checks auth state */
  public async isAuthenticated(): Promise<boolean> {
    if (!this.envService.isSupabaseEnabled()) return false;
    return await this.supabaseService.isAuthenticated();
  }

  /**
   * Checks if we should log event to Plausible
   * Returns false if:
   * - User disabled analytics
   * - Not running in browser
   * - Plausible script not loaded
   * @returns true if all checks passed, false otherwise
   */
  public checkIfShouldContinue(): boolean {
    // Cancel if user disabled analytics
    if (!this.plausibleEnabled) {
      return false;
    }

    // Cancel if not client
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') {
      return false;
    }

    // Cancel if Plausible script is not loaded
    if (typeof this.plausibleWindow.plausible !== 'function') {
      return false;
    }
    return true; // All checks passed, continue
  }

  /* Track a page view in Plausible */
  public async trackPageView(url?: string) {
    try {
      if (!this.checkIfShouldContinue() || !url) return;
      const isAuthenticated = await this.supabaseService.isAuthenticated();
      const eventName = isAuthenticated
        ? 'pageview_authenticated'
        : 'pageview_unauthenticated';
      const topLevel = url.replace(/^\/+/, '').split('/')[0] || 'home';
      this.plausibleWindow.plausible?.(eventName, { props: { topLevel, url } });
    } catch (error) {
      this.errorHandler.handleError({
        message: 'Unable to count page view',
        error,
        location: 'HitCountingService.trackPageView',
      });
    }
  }

  /* Track a key event in Plausible */
  public trackEvent<E extends EventType>(eventName: E, props?: Record<string, unknown>) {
    try {
      if (!this.checkIfShouldContinue()) return;
      this.plausibleWindow.plausible?.(eventName, { props });
    } catch (error) {
      this.errorHandler.handleError({
        message: 'Unable to log event',
        error,
        location: 'HitCountingService.trackPageView',
      });
    }
  }
}

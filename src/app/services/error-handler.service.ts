import { ErrorHandler, Injectable, isDevMode, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as Sentry from '@sentry/angular';
import { EnvService } from '~/app/services/environment.service';

import { GlobalMessageService } from '~/app/services/messaging.service';

declare const __APP_VERSION__: string;

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private printToConsole = printToConsole;
  handleError(error: unknown): void {
    this.printToConsole('Something unexpected happened', 'the core app', error);
    Sentry.captureException(error);
  }
}

/* Logs an error to the console (when in dev or debug mode) */
const printToConsole = (message?: string, location?: string, error?: unknown): void => {
  console.groupCollapsed(
    `%cError: ${message} in ${location || 'unknown location'}`,
    'background:#f93939;color:#fff;padding:0.1rem 0.25rem;border-radius:4px',
  );
  console.error(error);
  const d = new Date();
  const date = `at ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()} on ${d.toDateString()}`;
  console.log(
    `%cThis occurred ${date}, in ${location || 'an unknown location'}\n` +
      'Please reference the debugging documentation for next steps: ' +
      'http://domain-locker.com/about/developing/debugging',
    'font-size:10px; color:#f9a939;',
  );
  console.groupEnd();
};

export interface ErrorLogEntry {
  date: string;
  message: string;
  location: string;
  error: unknown;
}

interface ErrorParams {
  error?: Error | unknown; // Should be error, but might be funny error type
  message?: string; // Friendly message to show to user (if needed)
  location?: string; // Location in code where error occurred
  showToast?: boolean; // Whether to show a toast to the user
  date?: Date; // Date of error (if not now)
}

/**
 * Global error handler service.
 * Called whenever an error is caught in the app.
 * If running in dev or debug mode, logs to console.
 * If server has GT configured, and user has enabled logging, sends to GlitchTip.
 * If user-triggered, shows a toast message to the user.
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  private platformId = inject<object>(PLATFORM_ID);
  private globalMessageService = inject(GlobalMessageService);
  private envService = inject(EnvService);

  private glitchTipEnabled = false; // Don't log errors, unless enabled

  private lsKey = 'PRIVACY_disable-error-tracking';
  private printToConsole = printToConsole;

  /* Shows a popup toast message to the user (if user-triggered) */
  private showToast(title: string, message: string): void {
    this.globalMessageService.showMessage({
      severity: 'error',
      summary: title,
      detail: message,
    });
  }

  /* Determines whether to enable GlitchTip (if enabled at server-level, and not disabled by user) */
  private shouldEnableGlitchTip(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false; // Don't run on server-side
    const glitchTipDsn = this.envService.getGlitchTipDsn(); // Get DSN from environment service
    const disabledByUser = localStorage.getItem(this.lsKey) !== null; // Check if user disabled error tracking
    const isLocal = isDevMode(); // Check if we are running in development mode
    // Return false if no DSN, disabled by user, or running locally
    return !glitchTipDsn || disabledByUser || isLocal ? false : true;
  }

  /* Initializes GlitchTip error tracking (if not disabled by user or admin) */
  public initializeGlitchTip(): void {
    this.glitchTipEnabled = this.shouldEnableGlitchTip();
    if (!this.glitchTipEnabled) return;
    const glitchTipDsn = this.envService.getGlitchTipDsn() || undefined;
    try {
      Sentry.init({
        dsn: glitchTipDsn,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 1.0,
        release: __APP_VERSION__,
        environment: this.envService.getEnvironmentType(),
        denyUrls: ['localhost'],
      });
    } catch (e) {
      this.handleError({
        error: e,
        message:
          "Unable to initialize GlitchTip. Possibly due to adblock, invalid DSN, or user's privacy preferences",
        location: 'ErrorHandlerService.initializeGlitchTip',
        showToast: false,
      });
      this.glitchTipEnabled = false;
    }
  }

  /* Gets the user ID from local storage (if available) */
  private getUserId(): string | null {
    const projectName = this.envService.getProjectId() || 'domain-locker';
    let userId: string | null = null;
    if (projectName && typeof localStorage !== 'undefined') {
      const authObject = localStorage.getItem(`sb-${projectName}-auth-token`);
      if (authObject) {
        const user = JSON.parse(authObject)?.user;
        userId = user?.id || null;
      }
    }
    return userId;
  }

  /* Logs an error to GlitchTip with user context */
  private logToGlitchTip(message: string, location: string, error: unknown): void {
    if (!this.glitchTipEnabled) return;
    const userId = this.getUserId();
    Sentry.setUser(userId ? { id: userId } : null);
    Sentry.withScope((scope) => {
      scope.setContext('context', { message, location });
      Sentry.captureException(error);
    });
  }

  private saveToLocalStorage(message: string, location: string, error: unknown): void {
    if (!isPlatformBrowser(this.platformId) || !localStorage) return;
    const key = 'DL_error_log';
    const lsErrorLog = JSON.parse(localStorage.getItem(key) || '[]');
    lsErrorLog.push({ message, location, error, date: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(lsErrorLog));
  }

  /* Entry point for error handler, takes appropriate logging action */
  public handleError(params: ErrorParams): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const { error, message, location, showToast } = params;
    if (!error && !message) return; // Not much I can do without an error or message!

    // Log to console in development mode
    this.printToConsole(message, location, error);

    // Show error toast if showError is true
    if (showToast && message && error) {
      const errMessage = (error as { message?: string })?.message;
      if (errMessage) {
        this.showToast(message, errMessage);
      } else {
        this.showToast('Error', message);
      }
    }

    // Log error to Glitchtip (if enabled) with user context
    if (this.glitchTipEnabled && error) {
      this.logToGlitchTip(message || 'mystery error', location || '-', error);
    }

    // Save to recent error log in localstorage
    this.saveToLocalStorage(message || 'mystery error', location || '-', error);
  }

  public getRecentErrorLog(): ErrorLogEntry[] {
    if (!isPlatformBrowser(this.platformId) || !(typeof window !== 'undefined')) {
      return [];
    }
    return JSON.parse(localStorage.getItem('DL_error_log') || '[]').reverse();
  }

  public initializeWindowCatching() {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
      window.onerror = (message, source, lineno, colno, error) => {
        this.handleError({
          message: String(message),
          location: `window (${source}:${lineno}:${colno})`,
          error,
          showToast: false,
        });
      };

      window.onunhandledrejection = (event) => {
        this.handleError({
          message: 'Unhandled Promise Rejection',
          location: 'window.onunhandledrejection',
          error: event.reason,
          showToast: false,
        });
      };
    }
  }

  public printInitialDetails(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const environment = this.envService.getEnvironmentType();
    const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
    const enabledDb = this.envService.isSupabaseEnabled()
      ? 'Supabase'
      : this.envService.isPostgresEnabled()
        ? 'Postgres'
        : 'None';

    console.log(
      `\n%c🔐 Domain Locker V${appVersion}` +
        '%c\nLicensed under MIT, © Alicia Sykes 2025.\nSource: github.com/lissy93/domain-locker\n',
      'color:#a78bfa; background:#0b1021; font-size:1.5rem; padding:0.15rem 0.25rem; ' +
        'margin: 1rem auto 0.5rem auto; font-family: Helvetica; border: 2px solid #a78bfa; ' +
        'border-radius: 4px;font-weight: bold; text-shadow: 1px 1px 1px #a78bfabf;',
      'color: #a78bfa; font-size:10px; font-family: Helvetica; margin: 0;',
    );
    const s = 'color:#1fe3f1; font-weight: bold;';
    console.group('🐛 %cDebug Info', 'color:#a78bfa;');
    console.groupCollapsed('🏗️ %cEnvironment', 'color:#dc8bfa;');
    console.log('%cType', s, environment);
    console.log('%cApp Version', s, appVersion);
    console.log('%cDatabase', s, enabledDb);
    console.groupEnd();
    console.groupCollapsed('🌍 %cOrigin', 'color:#dc8bfa;');
    console.log('%cProtocol', s, window.location.protocol);
    console.log('%cHost', s, window.origin);
    console.log('%cPath', s, window.location.pathname);
    console.groupEnd();
    console.groupCollapsed('📱 %cDevice', 'color:#dc8bfa;');
    console.log('%cDate Fetched', s, new Date().getTime());
    console.log('%cOS', s, navigator['platform']);
    console.log('%cBrowser', s, navigator['appCodeName']);
    console.log('%cLanguage', s, navigator['language']);
    console.groupEnd();
    console.groupCollapsed('🔗 %cHelp Links', 'color:#dc8bfa;');
    console.log('%cDebug Tools', s, `${window.origin}/advanced`);
    console.log('%cSupport Docs', s, `${window.origin}/about/support`);
    console.log('%cGitHub', s, `https://github.com/lissy93/domain-locker`);
    console.groupEnd();
    console.groupEnd();
  }
}

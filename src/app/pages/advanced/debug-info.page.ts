import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, APP_ID, inject } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ErrorHandlerService, ErrorLogEntry } from '~/app/services/error-handler.service';
import { EnvService, EnvironmentType, EnvVar } from '~/app/services/environment.service';
import { BillingService } from '~/app/services/billing.service';
import { from, Observable } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { ThemeService } from '~/app/services/theme.service';
import { SupabaseService } from '~/app/services/supabase.service';
import { TranslationService } from '~/app/services/translation.service';
import DatabaseService from '~/app/services/database.service';
import { FeatureService } from '~/app/services/features.service';
import {
  AccessibilityOptions,
  AccessibilityService,
} from '~/app/services/accessibility-options.service';
import { GlobalMessageService } from '~/app/services/messaging.service';

declare const __APP_VERSION__: string;
// Similarly for app name
declare const __APP_NAME__: string;

/** Short interface for domain info */
interface DomainInfo {
  protocol: string;
  host: string;
  origin: string;
}

/** Short interface for screen info */
interface ScreenInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

@Component({
  standalone: true,
  selector: 'app-advanced-debug-info-page',
  imports: [CommonModule, PrimeNgModule],
  templateUrl: './debug-info.page.html',
  styles: [``],
})
export default class DebugInfoPage implements OnInit {
  private errorHandler = inject(ErrorHandlerService);
  private billingService = inject(BillingService);
  private envService = inject(EnvService);
  private themeService = inject(ThemeService);
  private supabaseService = inject(SupabaseService);
  private translationService = inject(TranslationService);
  private databaseService = inject(DatabaseService);
  private featureService = inject(FeatureService);
  private accessibilityService = inject(AccessibilityService);
  private messagingService = inject(GlobalMessageService);
  platformId = inject<object>(PLATFORM_ID);
  appId = inject(APP_ID);

  // Basic app info
  public appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  public appName = typeof __APP_NAME__ !== 'undefined' ? __APP_NAME__ : 'DL-App';
  public environmentType!: EnvironmentType;
  public errorLog: ErrorLogEntry[] = [];
  public enabledDb = { supabase: false, postgres: false };

  // Observables / data from services
  currentPlan$?: Observable<string | null>;
  user$?: Observable<User | null>;
  displayOptions?: { theme: string; darkMode: boolean; font: string; scale: string };
  accessibilityOptions?: AccessibilityOptions;
  language = 'English';
  localStorageKeys = '';
  cookies = '';
  userInfo: Record<string, unknown> = {};

  // Domain / Browser Info (client side)
  public domainInfo?: DomainInfo;
  public userAgent?: string;
  public platform?: string;
  public ipAddress?: string;
  public screenInfo?: ScreenInfo;
  public cookiesEnabled?: boolean;
  public navigatorLanguage?: string;
  public navigatorLanguages?: readonly string[];
  public userAgentData?: string;
  public doNotTrack?: string | null;
  public isOnline?: boolean;
  public hardwareConcurrency?: number;
  public deviceMemory?: number;
  public timeZone?: string;
  public orientation?: string;

  // Additional
  public setEnvVars: { envName: EnvVar; hasValue: boolean }[] = [];
  public featureChecks: { feature: string; enabled: boolean }[] = [];
  public tableChecks: { table: string; count: number | string; success: string }[] = [];
  public loadingTableChecks = false;

  ngOnInit(): void {
    // 1) Basic logs, environment type, DB usage
    this.errorLog = this.errorHandler.getRecentErrorLog();
    this.environmentType = this.envService.getEnvironmentType();
    this.enabledDb = {
      supabase: this.envService.isSupabaseEnabled(),
      postgres: this.envService.isPostgresEnabled(),
    };

    // 2) Observables
    this.currentPlan$ = this.billingService.getUserPlan();
    if (this.enabledDb.supabase) {
      this.user$ = from(this.supabaseService.getCurrentUser());
    }
    this.displayOptions = this.themeService.getUserPreferences();
    this.language = this.translationService.getLanguageToUse();
    this.accessibilityOptions = this.accessibilityService.getAccessibilityOptions() || {};

    // 3) Only gather certain data in browser
    if (isPlatformBrowser(this.platformId)) {
      this.localStorageKeys = Object.keys(window.localStorage).join('\n');
      const authTokenKey = Object.keys(window.localStorage).find(
        (key) => key.includes('sb-') && key.includes('-auth-token'),
      );
      this.userInfo = authTokenKey
        ? JSON.parse(window.localStorage.getItem(authTokenKey) || '{}')?.user || {}
        : {};
      this.cookies = document.cookie
        ? document.cookie.replaceAll('; ', '\n')
        : 'No cookies found';
      this.gatherDomainAndBrowserInfo();
      this.gatherExtendedNavigatorInfo();
      this.fetchUserIpAddress();
    }

    // 4) Feature checks
    this.featureService
      .featureReportForDebug()
      .then((features) => {
        this.featureChecks = features;
      })
      .catch((err) => {
        this.errorHandler.handleError({
          error: err,
          message: 'Failed to fetch feature checks',
          location: 'DebugInfoPage',
        });
      });

    // 5) Attempt table checks
    try {
      this.onCheckTables();
    } catch (err) {
      this.errorHandler.handleError({
        error: err,
        message: 'Failed to check tables',
        location: 'DebugInfoPage',
      });
    }

    // 6) Env vars
    this.setEnvVars = this.envService.checkAllEnvironmentalVariables();
  }

  /**
   * Basic domain & browser info:
   *  - window.location => domainInfo
   *  - navigator => userAgent, platform
   */
  private gatherDomainAndBrowserInfo(): void {
    try {
      this.domainInfo = {
        protocol: window.location.protocol,
        host: window.location.host,
        origin: window.location.origin,
      };
      this.userAgent = navigator.userAgent || 'UnknownAgent';
      this.platform = navigator.platform || 'UnknownPlatform';

      // screen info
      this.screenInfo = {
        width: window.screen.width,
        height: window.screen.height,
        devicePixelRatio: window.devicePixelRatio
          ? parseFloat(window.devicePixelRatio.toFixed(4))
          : 1,
      };

      // cookies
      this.cookiesEnabled = navigator.cookieEnabled;

      // language
      this.navigatorLanguage = navigator.language || 'none';
      this.navigatorLanguages = navigator.languages || [];
    } catch (err) {
      this.errorHandler.handleError({
        error: err,
        message: 'Failed to gather domain/browser info',
        location: 'DebugInfoPage',
      });
    }
  }

  /**
   * Extended info from navigator: userAgentData, doNotTrack, etc.
   */
  private async gatherExtendedNavigatorInfo(): Promise<void> {
    try {
      this.userAgentData = await this.getUserAgentData();
      this.doNotTrack = navigator.doNotTrack;
      this.isOnline = navigator.onLine;
      this.hardwareConcurrency = navigator.hardwareConcurrency || 1;
      this.deviceMemory =
        (navigator as unknown as { deviceMemory?: number }).deviceMemory || undefined;
      this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UnknownZone';
      this.orientation = window.screen.orientation?.type || 'UnknownOrientation';
    } catch (err) {
      console.warn('Extended navigator info fetch failed:', err);
    }
  }

  private async getUserAgentData() {
    interface UABrand {
      brand: string;
      version: string;
    }
    interface UAData {
      brands: UABrand[];
      mobile: boolean;
      platform: string;
      uaFullVersion?: string;
      getHighEntropyValues?: (
        hints: string[],
      ) => Promise<{ platform: string; uaFullVersion: string }>;
    }
    const nav = navigator as unknown as { userAgentData?: UAData };

    if (nav.userAgentData) {
      const { brands, mobile, platform, uaFullVersion } = nav.userAgentData;

      if (nav.userAgentData.getHighEntropyValues) {
        const highEntropy = await nav.userAgentData.getHighEntropyValues([
          'platform',
          'model',
          'uaFullVersion',
        ]);
        return `Using ${brands.map((b) => `${b.brand} (V${b.version})`).join(' → ')}, on ${highEntropy.platform} (${mobile ? 'mobile' : 'not mobile'}) with UA Version: ${highEntropy.uaFullVersion}`;
      }
      return `Using ${brands.map((b) => `${b.brand} (V${b.version})`).join(' → ')}, on ${platform} (${mobile ? 'mobile' : 'not mobile'}) with UA Version: ${uaFullVersion}`;
    }
    const { appName, appVersion, platform, userAgent } = navigator;
    return `${appName} V${appVersion} on ${platform}. User-Agent: ${userAgent}`;
  }

  /**
   * Fetch user IP from an external service, e.g. ipify
   */
  private fetchUserIpAddress(): void {
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((data) => {
        this.ipAddress = data?.ip || 'Unknown';
      })
      .catch((err) => {
        console.warn('Failed to fetch IP address:', err);
        this.ipAddress = 'FetchFailed';
      });
  }

  /**
   * Check DB tables
   */
  public onCheckTables() {
    this.loadingTableChecks = true;
    this.tableChecks = [];

    this.databaseService.instance.checkAllTables().subscribe({
      next: (results) => {
        this.tableChecks = results;
        this.loadingTableChecks = false;
      },
      error: (err) => {
        this.errorHandler.handleError({
          error: err,
          message: 'Failed to check tables',
          location: 'DebugInfoPage',
          showToast: true,
        });
        this.loadingTableChecks = false;
      },
    });
  }

  /** Dummy error generator for testing */
  public triggerDummyError(): void {
    this.errorHandler.handleError({
      error: new Error('Test Error- ignore me!'),
      message: 'This is a dummy error',
      location: 'DebugInfoPage',
      showToast: true,
    });
    this.errorLog = this.errorHandler.getRecentErrorLog();
  }

  copyAllToClipboard(): void {
    // 1) Safely get each pre element by ID
    const envPre = document.getElementById(
      'debug_environmentInfo',
    ) as HTMLPreElement | null;
    const errPre = document.getElementById('debug_errorLogs') as HTMLPreElement | null;
    const diagPre = document.getElementById('debug_diagnostics') as HTMLPreElement | null;
    const userPre = document.getElementById('debug_userInfo') as HTMLPreElement | null;

    // 2) Extract text content, fallback to empty string if not found
    const envText = envPre?.innerText ?? '';
    const errText = errPre?.innerText ?? '';
    const diagText = diagPre?.innerText ?? '';
    const userText = userPre?.innerText ?? '';

    // 3) Concatenate them with blank lines separating each
    const combinedText = [
      envText.trim(),
      errText.trim(),
      diagText.trim(),
      userText.trim(),
    ]
      .filter((section) => section.length > 0)
      .join('\n\n');

    // 4) Copy to clipboard, if available
    if (navigator?.clipboard && combinedText) {
      navigator.clipboard
        .writeText(combinedText)
        .then(() => {
          this.messagingService.showSuccess(
            'Copied',
            'All debug data has been copied to your clipboard.',
          );
        })
        .catch((err) => {
          this.errorHandler.handleError({
            error: err,
            message: 'Failed to copy debug data to clipboard',
            showToast: true,
          });
        });
    } else {
      this.errorHandler.handleError({
        message: 'Browser does not support clipboard.',
        showToast: true,
      });
    }
  }
}

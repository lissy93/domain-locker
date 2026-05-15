import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ActivatedRoute } from '@angular/router';
import { EnvService, EnvVar } from '~/app/services/environment.service';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import DatabaseService from '~/app/services/database.service';

interface DiagnosticEndpoint {
  label: string;
  description: string;
  url: string;
  loading: boolean;
  success: boolean | null;
  response?: unknown;
  errorMsg?: string;
  statusCode?: number;
  timeTaken?: number;
  bytesReceived?: number;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<
    string,
    string | number | boolean | readonly (string | number | boolean)[]
  >;
}

interface EndpointGroup {
  title: string;
  endpoints: DiagnosticEndpoint[];
  showReset: boolean;
  showRunAll?: boolean;
}

declare const __APP_VERSION__: string;

@Component({
  standalone: true,
  selector: 'app-advanced-diagnostic-actions-page',
  imports: [CommonModule, PrimeNgModule],
  templateUrl: './diagnostic-actions.page.html',
  styles: [``],
})
export default class ErrorPage implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private envService = inject(EnvService);
  private databaseService = inject(DatabaseService);

  errorMessage?: string;

  endpointGroup: EndpointGroup[] = [];

  endpoints: DiagnosticEndpoint[] = [];
  resolutionEndpoints: DiagnosticEndpoint[] = [];
  remoteEndpoints: DiagnosticEndpoint[] = [];

  appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  updateStatus = 'pending';
  updateMessage = '';

  databaseResults = '';
  databaseSuccess = '';

  sbBase = '';

  ngOnInit(): void {
    this.errorMessage =
      this.route.snapshot.queryParamMap.get('errorMessage') || undefined;
    this.sbBase = this.envService.getEnvVar('SUPABASE_URL') || '';

    this.resolutionEndpoints = [
      {
        label: 'Billing Check',
        description:
          'Checks for valid payment and billing status, and updates plan accordingly.',
        url: '',
        loading: false,
        success: null,
        method: 'GET',
      },
      {
        label: 'Update Domains',
        description:
          'Triggers updates of all your domains, finding changes and updating the database.',
        url: '',
        loading: false,
        success: null,
        method: 'GET',
      },
      {
        label: 'Dispatch Notifications',
        description:
          'Triggers all pending notifications to be sent, according to your notification preferences.',
        url: '',
        loading: false,
        success: null,
        method: 'GET',
      },
    ];

    this.endpoints = [
      {
        label: 'App Health Check',
        description: 'Checks the application is running and healthy.',
        url: '/api/health',
        loading: false,
        success: null,
        method: 'GET',
      },
      {
        label: 'Domain Info',
        description: `
          Fetches info about a domain. Used to auto-populate fields when adding a new domain,
          and also called when checking for domain updates.`,
        url: this.getEnvValue('DL_DOMAIN_INFO_API', '/api/domain-info'),
        loading: false,
        success: null,
        method: 'GET',
        params: { domain: 'example.com' },
      },
      {
        label: 'Domain Subs',
        description: `
          Returns the list of subdomains for a given domain. Used during subdomain discovery.`,
        url: this.getEnvValue('DL_DOMAIN_SUBS_API', '/api/domain-subs'),
        loading: false,
        success: null,
        params: { domain: 'example.com' },
      },
      {
        label: 'Domain Monitor',
        description: `
          Checks if a given website is up and running, and saves response times and details into db`,
        url: '/api/domain-monitor',
        loading: false,
        success: null,
        params: { domain: 'example.com' },
      },
      {
        label: 'Domain Updater',
        description:
          'Runs update script, to find new changes (from domain-info), and update the DB accordingly.',
        url: '/api/domain-updater',
        loading: false,
        success: null,
        params: { domain: 'example.com' },
      },
      {
        label: 'Postgres Executer',
        description:
          'Used to execute SQL commands server-side on self-hosted instances of Domain Locker.',
        url: '/api/pg-executer',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Status Info',
        description:
          'Ensures that services relied upon by the Domain Locker public instance are running well.',
        url: '/api/external-status-info',
        loading: false,
        success: null,
      },
    ];

    this.remoteEndpoints = [
      // - cleanup-notifications
      // - domain-updater
      // - expiration-invites
      // - expiration-reminders
      // - new-user-billing
      // - send-notification
      // - trigger-updates
      // - website-monitor
      {
        label: 'Cleanup Notifications',
        description:
          'Removes notifications 30 days or older, and triggers the sending of any unsent notifications',
        url: this.sbBase ? `${this.sbBase}/functions/v1/cleanup-notifications` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Domain Updater',
        description: 'Updates a given domain, finding changes and updating the database.',
        url: this.sbBase ? `${this.sbBase}/functions/v1/domain-updater` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Expiration Invites',
        description:
          'Creates calendar invites for domain names expiring 90 days from now.',
        url: this.sbBase ? `${this.sbBase}/functions/v1/expiration-invites` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Expiration Reminders',
        description: 'Triggers notifications for soon to be expiring domains.',
        url: this.sbBase ? `${this.sbBase}/functions/v1/expiration-reminders` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Billing Check',
        description:
          'Creates new billing record (if none exists), creates/verifies Stripe customer, and checks for active subscriptions',
        url: this.sbBase ? `${this.sbBase}/functions/v1/new-user-billing` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Send Notification',
        description: 'Sends a notification to a user, used by the notification system.',
        url: this.sbBase ? `${this.sbBase}/functions/v1/send-notification` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Trigger Updates',
        description:
          'Triggers updates for all domains, finding changes and updating the database.',
        url: this.sbBase ? `${this.sbBase}/functions/v1/trigger-updates` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
      {
        label: 'Website Monitor',
        description:
          "Runs uptime checks on domain names, for monitoring your website's availability, health and status.",
        url: this.sbBase ? `${this.sbBase}/functions/v1/website-monitor` : '',
        loading: false,
        success: null,
        method: 'POST',
      },
    ];

    this.endpointGroup = [
      {
        title: 'Account Checks',
        endpoints: this.resolutionEndpoints,
        showReset: false,
      },
      {
        title: 'Local Endpoint Tests',
        endpoints: this.endpoints,
        showReset: false,
        showRunAll: true,
      },
      {
        title: 'Remote Endpoint Tests',
        endpoints: this.remoteEndpoints,
        showReset: false,
        showRunAll: true,
      },
    ];
  }

  checkDatabaseConnection(): void {
    this.databaseResults = 'Loading...';
    this.databaseSuccess = '';
    try {
      this.databaseService.instance.checkAllTables().subscribe({
        next: (results) => {
          this.databaseResults = '';
          if (!results || !results.length) {
            throw new Error('No tables found in the database.');
          }
          this.databaseSuccess = 'passed';
          results.forEach((table) => {
            this.databaseResults += `${table.success} ${table.table} (${table.count} records)\n`;
            if (table.success !== '✅') {
              this.databaseSuccess = 'some_errors';
            }
          });
        },
        error: (err) => {
          this.databaseResults = `Error checking tables: ${err.message || err}`;
          this.databaseSuccess = 'errored';
        },
      });
    } catch (err) {
      const message = (err as Error)?.message || err;
      this.databaseResults = `Error checking tables: ${message}`;
      this.databaseSuccess = 'errored';
    }
  }

  checkAppVersion(): void {
    const currentVersion = this.appVersion;
    this.http
      .get<{
        version: string;
      }>(
        'https://raw.githubusercontent.com/Lissy93/domain-locker/refs/heads/main/package.json',
      )
      .subscribe({
        next: (data) => {
          const latestVersion = data.version;
          if (latestVersion && latestVersion !== currentVersion) {
            this.updateStatus = 'update_available';
            this.updateMessage = `A new version (${latestVersion}) is available. You are running ${currentVersion}.`;
          } else {
            this.updateStatus = 'up_to_date';
            this.updateMessage = `You are running the latest version (${currentVersion}).`;
          }
        },
        error: () => {
          this.updateStatus = 'error';
          this.updateMessage = 'Could not check for updates. Please try again later.';
        },
      });
  }

  getEnvValue(key: EnvVar, fallback?: string): string {
    return this.envService.getEnvVar(key, fallback) || fallback || '';
  }

  runAllEndpointTests(targetGroup: EndpointGroup): void {
    targetGroup.showReset = true;
    targetGroup.endpoints.forEach((ep) => {
      if (!ep.loading) {
        this.testEndpoint(ep);
      }
    });
  }

  resetAllEndpointTests(targetGroup: EndpointGroup): void {
    targetGroup.showReset = false;
    targetGroup.endpoints.forEach((ep) => {
      ep.loading = false;
      ep.success = null;
      ep.response = undefined;
      ep.errorMsg = undefined;
      ep.statusCode = undefined;
      ep.timeTaken = undefined;
      ep.bytesReceived = undefined;
    });
  }

  /**
   * Called when the user clicks “Run” on a particular endpoint.
   * It will:
   *  1) set loading=true,
   *  2) fetch the URL,
   *  3) record success/response or failure/message,
   *  4) set loading=false.
   */
  testEndpoint(ep: DiagnosticEndpoint, group?: EndpointGroup): void {
    if (group) group.showReset = true;

    ep.loading = true;
    ep.success = null;
    ep.response = undefined;
    ep.errorMsg = undefined;
    ep.statusCode = undefined;
    ep.timeTaken = undefined;

    const method = (ep.method || 'GET').toUpperCase();
    const start = performance.now();
    let httpCall;

    if (method === 'GET') {
      httpCall = this.http.get(ep.url, {
        observe: 'response',
        responseType: 'text',
        params: ep.params,
      });
    } else if (method === 'POST') {
      httpCall = this.http.post(ep.url, ep.params, {
        observe: 'response',
        responseType: 'text',
      });
    } else if (method === 'PUT') {
      httpCall = this.http.put(ep.url, ep.params, {
        observe: 'response',
        responseType: 'text',
      });
    } else if (method === 'DELETE') {
      httpCall = this.http.delete(ep.url, {
        observe: 'response',
        responseType: 'text',
        params: ep.params,
      });
    } else {
      ep.loading = false;
      ep.success = false;
      ep.errorMsg = `Unsupported HTTP method: ${method}`;
      return;
    }

    firstValueFrom(httpCall)
      .then((res: HttpResponse<string>) => {
        ep.timeTaken = Math.round(performance.now() - start);
        ep.statusCode = res.status;

        const raw = res.body || '';
        const ct = res.headers.get('Content-Type') || '';
        let parsed: unknown = raw;

        if (ct.includes('application/json')) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* ignore */
          }
        }

        ep.response = parsed;
        ep.bytesReceived = Number(res.headers.get('Content-Length')) || undefined;

        if (typeof parsed === 'string') {
          ep.success = ep.statusCode >= 200 && ep.statusCode < 300;
          ep.errorMsg = ep.success ? undefined : parsed;
        } else {
          const parsedObj = parsed as { error?: string } | null;
          if (parsedObj && parsedObj.error) {
            ep.success = false;
            ep.errorMsg = parsedObj.error;
          } else {
            ep.success = true;
          }
        }
      })
      .catch((err: { message?: string; error?: unknown; status?: number }) => {
        ep.timeTaken = Math.round(performance.now() - start);
        ep.success = false;
        let parsed: unknown = '';
        ep.errorMsg = err.message || JSON.stringify(err.error);
        if (err.error !== null && err.error !== undefined) {
          parsed = err.error;
          try {
            parsed = JSON.parse(parsed as string);
            if (typeof parsed === 'object' && (parsed as { message?: string }).message) {
              ep.errorMsg = (parsed as { message?: string }).message;
            }
          } catch {
            /* ignore */
          }
          ep.response = parsed;
        }
        ep.statusCode = err.status;
      })
      .finally(() => {
        ep.loading = false;
      });
  }
}

import { Component, OnDestroy, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import DatabaseService from '~/app/services/database.service';
import { SaveDomainData } from '~/app/../types/Database';
import { Subdomain } from '~/app/../types/common';
import { DomainInfo } from '~/app/../types/DomainInfo';
import {
  of,
  from,
  concatMap,
  delay,
  switchMap,
  catchError,
  map,
  Subscription,
} from 'rxjs';
import { PrimeNgModule } from '~/app/prime-ng.module';

import { Router } from '@angular/router';
import { notificationTypes } from '~/app/constants/notification-types';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { EnvService } from '~/app/services/environment.service';
import { HitCountingService } from '~/app/services/hit-counting.service';

/**
 * BulkAddComponent:
 *  - Step 1: user enters domain list
 *  - Step 2: user sees domain details (registrar, expiry, etc.)
 *  - Step 3: set notification preferences
 *  - Step 4: summary of saved/failed
 */
@Component({
  standalone: true,
  selector: 'app-domains-add-bulk-add-page',
  imports: [PrimeNgModule, ReactiveFormsModule],
  templateUrl: './bulk-add.page.html',
  styleUrls: ['./bulk-add.page.scss'],
})
export default class BulkAddComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private messageService = inject(GlobalMessageService);
  private errorHandler = inject(ErrorHandlerService);
  private databaseService = inject(DatabaseService);
  private router = inject(Router);
  private envService = inject(EnvService);
  private hitCountingService = inject(HitCountingService);

  step = 1;

  /** Our master form containing (domainList, domains[], notifications) */
  bulkAddForm: FormGroup;

  /** Loading states */
  processingDomains = false; // spinner for domain-info fetch
  fetchingSubs = false; // spinner if you want to show subdomain fetching
  savingDomains = false; // spinner for final save

  /**
   * Holds the fetched DomainInfo objects, keyed by domain name.
   * e.g. { 'example.com': {...}, 'test.com': {...} }
   */
  domainsInfo: Record<string, DomainInfo> = {};

  /**
   * Holds subdomains in a background fetch.
   * e.g. { 'example.com': ['test.example.com','...'], ... }
   */
  domainsSubMap: Record<string, Omit<Subdomain, 'id' | 'domainId'>[]> = {};

  /** After saving, which domains succeeded/failed? */
  savedDomains: string[] = [];
  failedDomains: string[] = [];

  /** Our standard notification type definitions */
  public readonly notificationOptions = notificationTypes;

  /** Subscription used for subdomain fetch so we can unsubscribe if needed. */
  private subdomainsFetchSub?: Subscription;

  constructor() {
    this.bulkAddForm = this.fb.group({
      domainList: ['', Validators.required],
      domains: this.fb.array([]),
      notifications: this.fb.group(
        this.notificationOptions.reduce((acc, opt) => {
          return { ...acc, [opt.key]: opt.default || false };
        }, {}),
      ),
    });
  }

  ngOnDestroy(): void {
    // clean up if subdomain fetch is still ongoing
    if (this.subdomainsFetchSub) {
      this.subdomainsFetchSub.unsubscribe();
    }
  }

  /** Easy getter for the 'domains' FormArray */
  get domains(): FormArray {
    return this.bulkAddForm.get('domains') as FormArray;
  }

  /** Return the FormGroup for a domain row by index */
  getDomainFormGroup(index: number): FormGroup {
    return this.domains.at(index) as FormGroup;
  }

  /**
   * Step 1: Process the raw domain list.
   * We fetch domain info (with a short delay between calls) to avoid rate-limiting.
   */
  processDomains(): void {
    this.processingDomains = true;
    const rawDomains = this.bulkAddForm.get('domainList')?.value as string;
    const domainList = this.parseDomainList(rawDomains);

    // Basic check
    if (!domainList.length) {
      this.messageService.showWarn(
        'No valid domains found',
        'Please enter at least one valid domain name to continue. Separate multiple domains with a comma or space.',
      );
      this.processingDomains = false;
      return;
    }

    // Clear old data
    this.domainsInfo = {};
    this.domainsSubMap = {};
    this.domains.clear();

    const domainInfoEndpoint = this.envService.getEnvVar(
      'DL_DOMAIN_INFO_API',
      '/api/domain-info',
    );

    // 1) fetch domain info sequentially with delay(500)
    from(domainList)
      .pipe(
        concatMap((domain) =>
          of(domain).pipe(
            delay(500),
            switchMap((d) =>
              this.http
                .get<{ domainInfo: DomainInfo }>(`${domainInfoEndpoint}?domain=${d}`)
                .pipe(
                  catchError((err) => {
                    this.errorHandler.handleError({
                      message: `Failed to auto-fetch domain info. Please fill manually for ${domain}.`,
                      error: err,
                      showToast: true,
                    });
                    return of(null);
                  }),
                  map((res) => ({ domain: d, data: res?.domainInfo })),
                ),
            ),
          ),
        ),
      )
      .subscribe({
        next: ({ domain, data }) => {
          if (data) {
            this.domainsInfo[domain] = data;
          }
        },
        error: (err) => {
          this.errorHandler.handleError({
            message: 'An unexpected error occurred fetching domain info.',
            error: err,
            showToast: true,
          });
        },
        complete: () => {
          // 2) after all domain info fetched
          this.populateDomainForms(domainList);

          // 3) let user continue to Step 2
          this.step = 2;
          this.processingDomains = false;

          // 4) in the background, fetch subdomains (with delay)
          this.fetchSubdomainsInBackground(domainList);
        },
      });
  }

  /**
   * parseDomainList: splits raw input by whitespace or comma,
   * removes protocol, ensures TLD etc.
   */
  parseDomainList(rawInput: string): string[] {
    const lines = rawInput.split(/[\s,]+/);
    const domainRegex =
      /^(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)(?:\/.*)?$/i;

    const result: string[] = [];
    for (const line of lines) {
      const match = line.trim().match(domainRegex);
      if (match && match[1]) {
        const domain = match[1].toLowerCase();
        // Ensure it has at least one dot (is a valid domain)
        if (domain.includes('.')) {
          result.push(domain);
        }
      }
    }
    return result;
  }

  /**
   * populateDomainForms: for each domain, create a form row with
   * domainName, registrar, expiryDate, tags, notes, subdomains
   */
  populateDomainForms(domainList: string[]): void {
    this.domains.clear();

    domainList.forEach((domain) => {
      const info = this.domainsInfo[domain];

      // parse expiry date if valid
      let expiry: Date | null = null;
      if (info?.dates?.expiry_date) {
        const d = new Date(info.dates.expiry_date);
        if (!isNaN(d.getTime())) {
          expiry = d;
        }
      }

      this.domains.push(
        this.fb.group({
          domainName: [domain, Validators.required],
          registrar: [info?.registrar?.name || '', Validators.required],
          expiryDate: [expiry, Validators.required],
          tags: [[]],
          notes: [''],
          subdomains: [[]],
        }),
      );
    });
  }

  /**
   * fetchSubdomainsInBackground: similar sequential approach with delay(500),
   * so we don't spam the /api/domain-subs endpoint.
   */
  fetchSubdomainsInBackground(domainList: string[]): void {
    this.fetchingSubs = true;

    const domainSubsEndpoint = this.envService.getEnvVar(
      'DL_DOMAIN_SUBS_API',
      '/api/domain-subs',
    );
    this.subdomainsFetchSub = from(domainList)
      .pipe(
        concatMap((domain) =>
          of(domain).pipe(
            delay(500),
            switchMap((d) =>
              this.http
                .get<
                  {
                    subdomain: string;
                    tags: string[];
                    type: string;
                    ip: string;
                    asn: string;
                    [key: string]: unknown; // In case there are other fields
                  }[]
                >(`${domainSubsEndpoint}?domain=${d}`)
                .pipe(
                  catchError((err) => {
                    this.errorHandler.handleError({
                      message: `Unable to auto-fetch subdomains for ${d}. You can add these later.`,
                      error: err,
                      showToast: true,
                    });
                    return of(
                      [] as {
                        subdomain: string;
                        tags: string[];
                        type: string;
                        ip: string;
                        asn: string;
                        [key: string]: unknown;
                      }[],
                    );
                  }),
                  map((subdomains) => ({ domain: d, subdomains })),
                ),
            ),
          ),
        ),
      )
      .subscribe({
        next: ({ domain, subdomains }) => {
          // Transform subdomains into [{ name, sd_info }, ...]
          const subdomainsForForm = subdomains.map((sub) => ({
            name: this.extractSubdomainName(sub.subdomain, domain),
            sd_info: JSON.stringify(sub), // store entire object as JSON
          }));

          // Save in local map if you want to keep track
          this.domainsSubMap[domain] = subdomainsForForm;

          // If you want to store them in the form so user can see/edit them:
          const idx = this.domains.value.findIndex(
            (grp: { domainName: string }) => grp.domainName === domain,
          );
          if (idx !== -1) {
            this.domains.at(idx).patchValue({ subdomains: subdomainsForForm });
          }
        },
        error: (err) => {
          this.errorHandler.handleError({
            message: `Unable to auto-fetch subdomains for some domain(s). You can add these later.`,
            error: err,
            showToast: true,
          });
        },
        complete: () => {
          this.fetchingSubs = false;
          this.messageService.showInfo(
            'Subdomains fetched',
            'Subdomains have been fetched for each domain',
          );
        },
      });
  }

  /**
   * Extract just the left-most subdomain name by removing '.<domain>' at the end.
   * e.g. "3d.ebay.com" with domain "ebay.com" -> returns "3d"
   */
  private extractSubdomainName(fullSubdomain: string, parentDomain: string): string {
    const suffix = '.' + parentDomain; // ".ebay.com"
    if (fullSubdomain.endsWith(suffix)) {
      return fullSubdomain.slice(0, -suffix.length);
    }
    // If for some reason it doesn't match, just return the entire string
    return fullSubdomain;
  }

  /**
   * Step 2 -> Step 3: ensure each domain row has
   * a registrar + expiryDate before continuing.
   */
  goToNotifications(): void {
    const invalidIndex = this.domains.controls.findIndex((ctrl) => {
      return !ctrl.get('registrar')?.value || !ctrl.get('expiryDate')?.value;
    });

    if (invalidIndex !== -1) {
      this.messageService.showWarn(
        'Missing Info',
        `Domain #${invalidIndex + 1} is missing registrar or expiry date. Please fill these before proceeding.`,
      );
      return;
    }

    this.step = 3;
  }

  /**
   * Step 3 -> Step 4: save all domains.
   * If domain exists -> update, else -> saveDomain.
   */
  saveDomains(): void {
    this.savingDomains = true;
    this.savedDomains = [];
    this.failedDomains = [];

    const notificationSettings = this.bulkAddForm.get('notifications')?.value || {};

    // 1) get existing domain names so we know which to update
    this.databaseService.instance
      .listDomainNames()
      .pipe(
        concatMap((existingDomains: string[]) => {
          // 2) sequentially process each domain in the form
          return from(this.domains.controls).pipe(
            concatMap((domainForm) => {
              const domainName: string = domainForm.get('domainName')?.value;
              const registrar: string = domainForm.get('registrar')?.value;
              const expiry: Date = domainForm.get('expiryDate')?.value;
              const notes: string = domainForm.get('notes')?.value;
              const tags: string[] = domainForm.get('tags')?.value || [];
              const _subdomains: string[] = domainForm.get('subdomains')?.value || [];

              const domainInfo = this.domainsInfo[domainName];
              // Build the SaveDomainData object
              const domainData: SaveDomainData = {
                domain: {
                  domain_name: domainName.toLowerCase(),
                  registrar: domainInfo?.registrar || {
                    name: registrar,
                    id: '',
                    url: '',
                    registryDomainId: '',
                  },
                  expiry_date: expiry,
                  notes: notes,
                  registration_date: domainInfo?.dates?.creation_date
                    ? new Date(domainInfo.dates.creation_date)
                    : undefined,
                  updated_date: domainInfo?.dates?.updated_date
                    ? new Date(domainInfo.dates.updated_date)
                    : undefined,
                },
                tags,
                // Build notifications array from "true" entries
                notifications: Object.entries(notificationSettings)
                  .filter(([_, isEnabled]) => isEnabled)
                  .map(([type]) => ({ type, isEnabled: true })),

                statuses: domainInfo?.status || [],
                ipAddresses: domainInfo?.ip_addresses
                  ? [
                      ...(domainInfo.ip_addresses.ipv4 || []).map((ip) => ({
                        ipAddress: ip,
                        isIpv6: false,
                      })),
                      ...(domainInfo.ip_addresses.ipv6 || []).map((ip) => ({
                        ipAddress: ip,
                        isIpv6: true,
                      })),
                    ]
                  : [],
                ssl: domainInfo?.ssl || undefined,
                whois: domainInfo?.whois || undefined,
                dns: domainInfo?.dns || undefined,
                registrar: domainInfo?.registrar || undefined,
                host: domainInfo?.host
                  ? {
                      ...domainInfo.host,
                      // transform host.asNumber if needed, e.g. remove "AS" prefix
                      asNumber:
                        domainInfo.host.asNumber?.replace(/[^\d]/g, '') ||
                        domainInfo.host.asNumber,
                    }
                  : undefined,
                subdomains: this.domainsSubMap[domainName] || [],
                links: domainInfo?.links || [],
              };

              const operation = existingDomains.includes(domainName)
                ? this.databaseService.instance.updateDomain(domainName, domainData)
                : this.databaseService.instance.saveDomain(domainData);

              return operation.pipe(
                map(() => ({ domain: domainName, success: true })),
                catchError((error) => {
                  this.errorHandler.handleError({
                    message: `Error saving ${domainName}`,
                    error,
                    showToast: true,
                  });
                  return of({ domain: domainName, success: false, error });
                }),
              );
            }),
          );
        }),
      )
      .subscribe({
        next: ({ domain, success }) => {
          if (success) {
            this.hitCountingService.trackEvent('add_domain', { location: 'bulk' });
            this.savedDomains.push(domain);
            this.messageService.showSuccess(
              'Success',
              `${domain} has been added to your account`,
            );
          } else {
            this.failedDomains.push(domain);

            this.errorHandler.handleError({
              message: `Failed to save domain: ${domain}`,
              showToast: true,
            });
          }
        },
        error: (err) => {
          this.errorHandler.handleError({
            message: 'An unexpected error occurred while saving domains.',
            error: err,
            showToast: true,
          });
          this.savingDomains = false;
        },
        complete: () => {
          this.savingDomains = false;
          this.step = 4; // summary screen
          this.messageService.showInfo(
            'Bulk Add Complete',
            `${this.savedDomains.length} domains saved, ${this.failedDomains.length} failed.`,
          );
        },
      });
  }

  /**
   * Step 4: user can click a button to return home
   */
  goToHomePage(): void {
    this.router.navigate(['/']);
  }
}

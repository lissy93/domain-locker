import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  firstValueFrom,
  lastValueFrom,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { GlobalMessageService } from '~/app/services/messaging.service';
import {
  autoSubdomainsReadyForSave,
  filterOutIgnoredSubdomains,
} from '~/app/pages/assets/subdomains/subdomain-utils';
import { SaveDomainData, DbDomain } from '~/app/../types/Database';
import { Registrar } from '~/app/../types/common';
import { EnvService } from '~/app/services/environment.service';
import { FeatureService } from '~/app/services/features.service';
import { HitCountingService } from '~/app/services/hit-counting.service';

interface QuickDomainInfo {
  domainName: string;
  registrar?: { name: string; id: string; url: string; registryDomainId: string };
  dates?: { expiry_date?: string; creation_date?: string; updated_date?: string };
  status?: string[];
  ipAddresses?: { ipv4?: string[]; ipv6?: string[] };
  whois?: import('~/app/../types/common').Contact;
  dns?: {
    dnssec?: string;
    nameServers?: string[];
    mxRecords?: string[];
    txtRecords?: string[];
  };
  ssl?: {
    issuer?: string | null;
    valid_from?: string;
    valid_to?: string;
    subject?: string;
    key_size?: number;
    signature_algorithm?: string;
    issuer_country?: string;
    fingerprint?: string;
  };
  host?: {
    query?: string;
    country?: string;
    city?: string;
    region?: string;
    isp?: string;
    org?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
    as?: string;
  };
}

@Component({
  selector: 'app-quick-add-domain',
  standalone: true,
  imports: [ReactiveFormsModule, PrimeNgModule],
  templateUrl: './index.page.html',
})
export default class QuickAddDomain {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);
  private messagingService = inject(GlobalMessageService);
  private envService = inject(EnvService);
  private featureService = inject(FeatureService);
  private hitCountingService = inject(HitCountingService);

  @Input() isInModal = false;
  @Input() afterSave: (p?: string) => void = () => {
    /* no-op */
  };
  @Output() $afterSave = new EventEmitter<string>();
  isLoading = false;

  domainForm = this.fb.group({
    domainName: [
      '',
      [
        Validators.required,
        Validators.pattern(
          /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i,
        ),
      ],
    ],
  });

  defaultNotifications = [{ type: 'expiry_domain', isEnabled: true }];

  async onSubmit(): Promise<void> {
    if (this.domainForm.invalid) return;

    this.isLoading = true;
    const domainName = this.domainForm.value.domainName?.trim();
    if (!domainName) {
      this.messagingService.showError(
        'Invalid domain name',
        'Please enter a valid domain name to proceed.',
      );
      return;
    }

    try {
      // 1) Check for duplicates
      const alreadyExists = await this.databaseService.instance.domainExists(
        null,
        domainName,
      );
      if (alreadyExists) {
        this.messagingService.showError(
          'Duplicate domain',
          `The domain "${domainName}" has already been added to your collection.`,
        );
        return;
      }

      // Check limit
      try {
        const domainLimit = (await firstValueFrom(
          this.featureService.getFeatureValue('domainLimit'),
        )) as number;
        const domainCount = (await firstValueFrom(
          this.databaseService.instance.getTotalDomains(),
        )) as number;
        if (domainLimit && domainCount >= domainLimit) {
          this.messagingService.showError(
            'Domain limit reached',
            `You have reached your domain limit of ${domainLimit}. Please remove some domains before adding new ones.`,
          );
          return;
        }
      } catch (error) {
        this.errorHandler.handleError({
          error,
          message: 'Failed to check domain limit.',
          location: 'Add Domain',
        });
      }

      // Fetch domain info
      const domainInfoEndpoint = this.envService.getEnvVar(
        'DL_DOMAIN_INFO_API',
        '/api/domain-info',
      );
      const domainInfo = (
        await lastValueFrom(
          this.http.get<{ domainInfo: QuickDomainInfo }>(
            `${domainInfoEndpoint}?domain=${domainName}`,
          ),
        )
      )?.domainInfo;

      if (!domainInfo?.domainName) {
        this.router.navigate(['/domains/add'], { queryParams: { domain: domainName } });
        throw new Error(
          "Domain information could not be fetched, we'll redirect you to a form where you can enter it manually.",
        );
      }

      // Construct and save domain data
      const domainData = this.constructDomainData(domainInfo);
      await this.databaseService.instance.saveDomain(domainData);

      this.messagingService.showSuccess(
        'Domain added successfully.',
        `${domainName} has been added to your collection and is now ready to use.`,
      );

      if (domainName) {
        this.searchForSubdomains(domainName);
      }

      // Track the event
      this.hitCountingService.trackEvent('add_domain', { location: 'quick' });

      // Redirect or emit event
      if (this.isInModal) {
        this.$afterSave.emit(domainName);
      } else {
        this.router.navigate(['/domains', domainName]);
      }
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to add domain. Please try again.',
        showToast: true,
        location: 'Add Domain',
      });
    } finally {
      this.isLoading = false;
    }
  }

  private makeDateOrUndefined(date: string | undefined): Date | undefined {
    return date ? new Date(date) : undefined;
  }

  private searchForSubdomains(domainName: string) {
    this.isLoading = true;
    const domainSubsEndpoint = this.envService.getEnvVar(
      'DL_DOMAIN_SUBS_API',
      '/api/domain-subs',
    );
    this.http
      .get<{ subdomain: string }[]>(`${domainSubsEndpoint}?domain=${domainName}`)
      .pipe(
        // 1) filter out ignored subdomains
        map((response) => filterOutIgnoredSubdomains(response, domainName)),
        // 2) pass them to a helper that handles “found vs none,”
        //    returning either a saving Observable or `of(null)`
        switchMap((validSubs) => this.handleDiscoveredSubdomains(validSubs, domainName)),
        // 3) handle any error that happened in the pipeline
        catchError((error) => {
          this.errorHandler.handleError({ error, message: 'Failed to save subdomains.' });
          return of(null);
        }),
        // 4) stop loading no matter what
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe();
  }

  /**
   * A small helper that shows messages and returns an Observable
   * that either saves subdomains or just completes immediately.
   */
  private handleDiscoveredSubdomains(
    validSubdomains: { subdomain: string }[],
    domainName: string,
  ): Observable<unknown> {
    if (!validSubdomains.length) {
      return of(null);
    }
    const subdomainsReadyForSave = autoSubdomainsReadyForSave(validSubdomains);

    return this.databaseService.instance.subdomainsQueries
      .saveSubdomainsForDomainName(domainName, subdomainsReadyForSave)
      .pipe(
        tap(() => {
          this.messagingService.showMessage({
            severity: 'info',
            summary: 'Added Subdomains',
            detail: `${validSubdomains.length} subdomains were appended to ${domainName}.`,
          });
        }),
      );
  }

  private constructDomainData(domainInfo: QuickDomainInfo): SaveDomainData {
    return {
      domain: {
        domain_name: domainInfo.domainName.toLowerCase(),
        registrar: domainInfo.registrar?.name as unknown as Registrar,
        expiry_date: this.makeDateOrUndefined(domainInfo.dates?.expiry_date),
        registration_date: this.makeDateOrUndefined(domainInfo.dates?.creation_date),
        updated_date: this.makeDateOrUndefined(domainInfo.dates?.updated_date),
        notes: '',
      },
      statuses: domainInfo.status || [],
      registrar: domainInfo.registrar,
      ipAddresses: [
        ...(domainInfo.ipAddresses?.ipv4?.map((ip: string) => ({
          ipAddress: ip,
          isIpv6: false,
        })) || []),
        ...(domainInfo.ipAddresses?.ipv6?.map((ip: string) => ({
          ipAddress: ip,
          isIpv6: true,
        })) || []),
      ],
      whois: domainInfo.whois || undefined,
      dns: {
        dnssec: domainInfo.dns?.dnssec || '',
        nameServers: domainInfo.dns?.nameServers || [],
        mxRecords: domainInfo.dns?.mxRecords || [],
        txtRecords: domainInfo.dns?.txtRecords || [],
      },
      ssl: {
        issuer: domainInfo.ssl?.issuer ?? null,
        valid_from: domainInfo.ssl?.valid_from || '',
        valid_to: domainInfo.ssl?.valid_to || '',
        subject: domainInfo.ssl?.subject || 'Unknown',
        key_size: domainInfo.ssl?.key_size || 0,
        signature_algorithm: domainInfo.ssl?.signature_algorithm || 'Unknown',
        issuer_country: domainInfo.ssl?.issuer_country || 'Unknown',
        fingerprint: domainInfo.ssl?.fingerprint || 'Unknown',
      },
      host: domainInfo.host?.query
        ? ({
            country: domainInfo.host.country || 'Unknown',
            city: domainInfo.host.city || 'Unknown',
            region: domainInfo.host.region || 'Unknown',
            isp: domainInfo.host.isp || 'Unknown',
            org: domainInfo.host.org || 'Unknown',
            query: domainInfo.host.query,
            lat: domainInfo.host.lat || 0,
            lon: domainInfo.host.lon || 0,
            timezone: domainInfo.host.timezone || 'Unknown',
            asNumber: domainInfo.host.as || 'Unknown',
          } as DbDomain['host'])
        : undefined,
      subdomains: [],
      notifications: this.defaultNotifications,
      tags: [],
    };
  }

  cleanDomainName(domain: string) {
    if (!domain || typeof domain !== 'string') return '';
    return domain
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
  }

  onDomainNameBlur() {
    const control = this.domainForm.get('domainName');
    if (!control) return;
    const value = (control.value || '').trim();
    const cleanDomain = this.cleanDomainName(value);
    control.setValue(cleanDomain);
  }

  navigateToDetailedAdd() {
    const domain = this.cleanDomainName(this.domainForm.value.domainName || '');
    this.router.navigate(['/domains/add'], { queryParams: { domain } });
  }
}

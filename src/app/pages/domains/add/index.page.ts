import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ConfirmationService, MessageService, MenuItem } from 'primeng/api';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { catchError, throwError, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import DatabaseService from '~/app/services/database.service';
import { SaveDomainData } from '~/app/../types/Database';
import { notificationTypes } from '~/app/constants/notification-types';
import { TableModule } from 'primeng/table';
import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';

import type { DomainInfo } from '~/app/../types/DomainInfo';
import { ActivatedRoute, Router } from '@angular/router';
import { Registrar } from '~/app/../types/common';
import { subdomainsReadyForSave } from '~/app/pages/assets/subdomains/subdomain-utils';
import { EnvService } from '~/app/services/environment.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { HitCountingService } from '~/app/services/hit-counting.service';
import { RegistrarAutocompleteService } from '~/app/services/registrar-autocomplete.service';

@Component({
  selector: 'app-domains-add-page',
  standalone: true,
  imports: [PrimeNgModule, ReactiveFormsModule, CommonModule, TableModule],
  providers: [ConfirmationService],
  templateUrl: './add.page.html',
  styleUrls: ['./add.page.scss'],
})
export default class AddDomainComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private databaseService = inject(DatabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private envService = inject(EnvService);
  private errorHandler = inject(ErrorHandlerService);
  private hitCountingService = inject(HitCountingService);
  private cdr = inject(ChangeDetectorRef);
  registrarAutocomplete = inject(RegistrarAutocompleteService);

  public domainForm!: FormGroup;
  public activeIndex = 0;
  public isProcessing = false;
  public domainInfo: DomainInfo | null = null;
  public tableData: { key: string; value: string }[] = [];
  public errorMessage = '';
  public isLoading = false;
  private destroy$ = new Subject<void>();
  private existingDomains: string[] = [];
  public showDomainError = false;
  public readonly notificationOptions = notificationTypes;
  private subdomainInfo: { subdomain: string; [key: string]: unknown }[] = [];
  public initialDomain = '';

  public incompleteDomainInfo = false;

  // Registrar autocomplete properties
  public filteredRegistrars: string[] = [];
  public registrarLoadFailed = false;

  public readonly saveOptions: MenuItem[] = [
    {
      label: 'Save and Add New',
      icon: 'pi pi-plus',
      command: () => this.saveAndAddNew(),
    },
    {
      label: 'Discard',
      icon: 'pi pi-trash',
      command: () => this.confirmDiscard(),
    },
  ];

  ngOnInit(): void {
    this.initialDomain = this.route.snapshot.queryParamMap.get('domain') || '';
    this.initializeForm();
    this.fetchExistingDomains();
    this.setupDomainValidation();
    this.registrarAutocomplete.loadRegistrars();

    // Subscribe to registrar error state for reactivity
    this.registrarAutocomplete
      .getHasError$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (hasError) => {
          this.registrarLoadFailed = hasError;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    const notificationControls = this.notificationOptions.reduce(
      (acc, option) => {
        acc[option.key] = [option.default || false];
        return acc;
      },
      {} as Record<string, [boolean]>,
    );

    this.domainForm = this.fb.group({
      domainName: [
        this.initialDomain,
        [
          Validators.required,
          Validators.pattern(
            /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i,
          ),
          this.domainExistsValidator(),
        ],
      ],
      registrar: ['', Validators.required],
      expiryDate: ['', Validators.required],
      tags: [[], [this.tagsValidator()]],
      notes: [
        '',
        [Validators.maxLength(255), Validators.pattern(/^[a-zA-Z0-9\s.,!?'"()-]+$/)],
      ],
      notifications: this.fb.group(notificationControls),
      subdomains: [[]],
    });

    // Revalidate domainName when existingDomains is updated
    this.domainForm.get('domainName')?.valueChanges.pipe(takeUntil(this.destroy$));

    if (this.initialDomain) {
      this.onNextStep();
    }
  }

  private setupDomainValidation(): void {
    const domainControl = this.domainForm.get('domainName');
    if (domainControl) {
      domainControl.valueChanges
        .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
        .subscribe(() => {
          if (domainControl.valid) {
            this.showDomainError = false;
          } else if (domainControl.touched) {
            this.showDomainError = true;
          }
        });
      domainControl.statusChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.showDomainError = domainControl.touched && domainControl.invalid;
      });
    }
  }

  private fetchExistingDomains(): void {
    this.databaseService.instance
      .listDomainNames()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (domains) => {
          this.existingDomains = domains;
          this.domainForm.get('domainName')?.updateValueAndValidity();
        },
        error: (error) => {
          this.errorHandler.handleError({
            error,
            message: 'Failed to fetch existing domains',
            location: 'AddDomainComponent.fetchExistingDomains',
          });
          this.existingDomains = [];
        },
      });
  }

  /**
   * Filters registrars based on user input for autocomplete
   */
  public filterRegistrars(event: AutoCompleteCompleteEvent): void {
    this.filteredRegistrars = this.registrarAutocomplete.filterRegistrars(event.query);
  }

  private domainExistsValidator(): ValidatorFn {
    return (control: AbstractControl): Record<string, boolean> | null => {
      const domain = control.value?.toLowerCase();
      if (domain && this.existingDomains.includes(domain)) {
        return { domainExists: true };
      }
      return null;
    };
  }

  public async onNextStep(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const domainNameControl = this.domainForm.get('domainName');
      if (this.activeIndex === 0 && domainNameControl?.valid) {
        await this.fetchDomainInfo();
      }

      if (this.activeIndex < 3) {
        this.activeIndex++;
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isProcessing = false;
      this.isLoading = false;
    }
  }

  /**
   * Handles the previous step in the form process
   */
  public onPreviousStep(): void {
    if (this.activeIndex > 0) {
      this.activeIndex--;
    }
  }

  /**
   * Fetches domain information from the API
   */
  private async fetchDomainInfo(): Promise<void> {
    const domainName = this.domainForm.get('domainName')?.value;
    if (!domainName) return;
    const domainInfoEndpoint = this.envService.getEnvVar(
      'DL_DOMAIN_INFO_API',
      '/api/domain-info',
    );
    this.http
      .get<{ domainInfo: DomainInfo }>(`${domainInfoEndpoint}?domain=${domainName}`)
      .pipe(catchError(this.handleHttpError.bind(this)))
      .subscribe({
        next: async (fetchedDomainInfo) => {
          const domainInfo = fetchedDomainInfo.domainInfo;
          if (this.isDomainInfoValid(domainInfo)) {
            this.domainInfo = domainInfo;
            this.updateFormWithDomainInfo();
            this.prepareTableData();
            this.domainForm.patchValue({ statuses: domainInfo.status || [] });

            // At this point, domain is valid, and we fetch subdomains in the background
            await this.fetchSubdomains(domainName);
          } else {
            this.incompleteDomainInfo = true;
            this.messageService.add({
              severity: 'warn',
              summary: 'Warning',
              detail:
                "Domain information could not be found, you'll need to enter it manually",
            });
            throw new Error('Invalid domain information received');
          }
        },
        error: (error) => {
          this.handleError(error);
        },
      });
  }

  /**
   * Fetches subdomains, and subdomain info for the current domain
   */
  private async fetchSubdomains(domainName: string): Promise<void> {
    try {
      const domainSubsEndpoint = this.envService.getEnvVar(
        'DL_DOMAIN_SUBS_API',
        '/api/domain-subs',
      );
      const response = await this.http
        .get(`${domainSubsEndpoint}?domain=${domainName}`)
        .toPromise();
      if (Array.isArray(response)) {
        this.subdomainInfo = response;
        const subdomainNames = response.map((sub) => sub.subdomain);

        // Populate the subdomains in the form
        this.domainForm.patchValue({ subdomains: subdomainNames });
      } else {
        this.errorHandler.handleError({
          message: 'Unexpected subdomain data format',
          location: 'AddDomainComponent.fetchExistingDomains',
        });
      }
    } catch (error) {
      this.errorHandler.handleError({
        error,
        showToast: true,
        message: 'Unable to fetch subdomain info',
        location: 'AddDomainComponent.fetchSubdomains',
      });
    }
  }

  /**
   * Checks if the fetched domain info is valid
   */
  private isDomainInfoValid(info: DomainInfo): boolean {
    return !!info && !!info.domainName && info.domainName !== 'Unknown';
  }

  /**
   * Updates the form with fetched domain information
   */
  private updateFormWithDomainInfo(): void {
    if (!this.domainInfo) return;

    const expiration =
      this.domainInfo.dates.expiry_date && this.domainInfo.dates.expiry_date !== 'Unknown'
        ? new Date(this.domainInfo.dates.expiry_date)
        : null;

    this.domainForm.patchValue({
      registrar: this.domainInfo.registrar.name,
      expiryDate: expiration,
    });

    if (!this.domainInfo.registrar.name || !expiration) {
      this.incompleteDomainInfo = true;
    }
    if (this.domainInfo.registrar.name && !expiration) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: "Couldn't determine domain expiration date, please enter it manually",
      });
    }
  }

  /**
   * Prepares table data for display
   */
  private prepareTableData(): void {
    if (!this.domainInfo) return;

    this.tableData = Object.entries(this.domainInfo)
      .flatMap(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return Object.entries(value).map(([subKey, subValue]) => ({
            key: `${key} ${subKey}`,
            value: Array.isArray(subValue)
              ? subValue.join(', ')
              : subValue?.toString() || '',
          }));
        }
        return [{ key, value: value?.toString() || '' }];
      })
      .filter((entry) => entry.value && entry.value !== 'Unknown');
  }

  private makeDateOrUndefined(date: string | undefined): Date | undefined {
    return date ? new Date(date) : undefined;
  }

  private formatDomainName(domainName: string): string {
    return domainName
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');
  }

  /**
   * Handles form submission
   */
  async onSubmit() {
    if (this.domainForm.valid) {
      try {
        const formValue = this.domainForm.value;

        const subdomains = subdomainsReadyForSave(
          formValue.subdomains,
          this.subdomainInfo,
        );

        const domainData: SaveDomainData = {
          domain: {
            domain_name: this.formatDomainName(formValue.domainName),
            registration_date: this.makeDateOrUndefined(
              this.domainInfo?.dates.creation_date,
            ),
            updated_date: this.makeDateOrUndefined(this.domainInfo?.dates.updated_date),
            registrar: formValue.registrar,
            expiry_date: formValue.expiryDate,
            notes: formValue.notes,
          },
          statuses: this.domainInfo?.status || [],
          ipAddresses:
            this.domainInfo?.ip_addresses.ipv4
              .map((ip) => ({ ipAddress: ip, isIpv6: false }))
              .concat(
                this.domainInfo?.ip_addresses.ipv6.map((ip) => ({
                  ipAddress: ip,
                  isIpv6: true,
                })),
              ) || [],
          tags: formValue.tags,
          notifications: Object.entries(formValue.notifications)
            .filter(([_, isEnabled]) => isEnabled)
            .map(([type, _]) => ({ type, isEnabled: true })),
          whois: this.domainInfo?.whois,
          dns: this.domainInfo?.dns,
          ssl: this.domainInfo?.ssl,
          host: this.domainInfo?.host || undefined,
          registrar: this.domainInfo?.registrar as Registrar,
          subdomains,
        };

        if (formValue.registrar) {
          domainData.domain.registrar = formValue.registrar;
        }

        await this.databaseService.instance.saveDomain(domainData);
        const name = domainData.domain.domain_name;
        this.hitCountingService.trackEvent('add_domain', { location: 'full' });
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Domain ${name} added successfully`,
        });
        this.router.navigate(['/domains', name], { queryParams: { update: true } });
      } catch (error) {
        this.handleError(error);
      }
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please fill in all required fields correctly.',
      });
    }
  }

  /**
   * Saves the current form and resets it for a new entry
   */
  public saveAndAddNew(): void {
    this.onSubmit();
    this.domainForm.reset();
    this.activeIndex = 0;
  }

  /**
   * Confirms discarding the current form
   */
  public confirmDiscard(): void {
    this.confirmationService.confirm({
      message:
        'Are you sure you want to discard this domain? All entered information will be lost.',
      accept: () => {
        this.domainForm.reset();
        this.activeIndex = 0;
      },
    });
  }

  /**
   * Validator for tags
   */
  private tagsValidator(): ValidatorFn {
    return (control: AbstractControl): Record<string, boolean | string[]> | null => {
      const tags = control.value as string[];

      if (tags.length > 8) {
        return { maxTags: true };
      }

      const uniqueTags = new Set(tags);
      if (uniqueTags.size !== tags.length) {
        return { duplicateTags: true };
      }

      const validTagRegex = /^[a-zA-Z0-9]+$/;
      const invalidTags = tags.filter((tag) => !validTagRegex.test(tag));
      if (invalidTags.length > 0) {
        return { invalidTags: invalidTags };
      }

      return null;
    };
  }

  /**
   * Handles key press events
   */
  public onEnterKey(event: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      if (this.isProcessing) return;

      if (this.activeIndex < 2) {
        this.onNextStep();
      } else {
        this.onSubmit();
      }
    }
  }

  public getDomainErrorMessage(): string {
    const domainControl = this.domainForm.get('domainName');
    if (domainControl?.errors?.['domainExists']) {
      return 'This domain has already been added.';
    }
    if (domainControl?.errors?.['required']) {
      return 'Domain name is required.';
    }
    if (domainControl?.errors?.['pattern']) {
      return 'Please enter a valid domain name.';
    }
    return '';
  }

  /**
   * Gets error message for tags
   */
  public getTagsErrorMessage(): string {
    const tagsControl = this.domainForm.get('tags');
    if (tagsControl?.errors) {
      if (tagsControl.errors['maxTags']) {
        return 'Maximum of 8 tags allowed.';
      }
      if (tagsControl.errors['duplicateTags']) {
        return 'Duplicate tags are not allowed.';
      }
      if (tagsControl.errors['invalidTags']) {
        return `Invalid tags: ${tagsControl.errors['invalidTags'].join(', ')}. Tags can only contain letters and numbers.`;
      }
    }
    return '';
  }

  /**
   * Checks if any notifications are enabled
   */
  public hasEnabledNotifications(): boolean {
    const notificationsGroup = this.domainForm.get('notifications');
    return notificationsGroup
      ? Object.values(notificationsGroup.value).some((value) => value === true)
      : false;
  }

  /**
   * Gets error message for notes
   */
  public getNotesErrorMessage(): string {
    const notesControl = this.domainForm.get('notes');
    if (notesControl?.errors) {
      if (notesControl.errors['maxlength']) {
        return `Notes cannot exceed 255 characters (currently ${notesControl.errors['maxlength'].actualLength}).`;
      }
      if (notesControl.errors['pattern']) {
        return 'Notes can only contain letters, numbers, and basic punctuation.';
      }
    }
    return '';
  }

  /**
   * Handles HTTP errors
   */
  private handleHttpError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    this.errorHandler.handleError({
      error,
      message: errorMessage,
      location: 'AddDomainComponent.httpError',
    });
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Handles general errors
   */
  private handleError(error: unknown): void {
    this.errorHandler.handleError({
      error,
      showToast: true,
      message: 'An error occurred while processing your request',
      location: 'AddDomainComponent.handleError',
    });
    this.domainForm.patchValue({
      registrar: '',
      expiryDate: null,
    });
  }
}

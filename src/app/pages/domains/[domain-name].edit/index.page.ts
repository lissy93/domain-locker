import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import DatabaseService from '~/app/services/database.service';
import { DbDomain, Link, SaveDomainData } from '~/app/../types/Database';
import { notificationTypes, NotificationType } from '~/app/constants/notification-types';
import { PrimeNgModule } from '~/app/prime-ng.module';

import { ReactiveFormsModule } from '@angular/forms';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { RegistrarAutocompleteService } from '~/app/services/registrar-autocomplete.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-domains-domain-name-edit-page',
  templateUrl: './edit-domain.page.html',
  styleUrls: ['./edit-domain.page.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, PrimeNgModule],
  providers: [MessageService],
})
export default class EditDomainComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private globalMessageService = inject(GlobalMessageService);
  private cdr = inject(ChangeDetectorRef);
  registrarAutocomplete = inject(RegistrarAutocompleteService);

  domainForm: FormGroup;
  domain: DbDomain | undefined;
  notificationTypes: NotificationType[] = notificationTypes;
  public isLoading = true;

  // Registrar autocomplete properties
  public filteredRegistrars: string[] = [];
  public registrarLoadFailed = false;
  private destroy$ = new Subject<void>();

  constructor() {
    this.domainForm = this.fb.group({
      registrar: ['', Validators.required],
      expiryDate: [null, Validators.required],
      tags: [[]],
      notes: [''],
      notifications: this.fb.group({}),
      subdomains: [[]],
      links: this.fb.array([]),
    });

    this.notificationTypes.forEach((type) => {
      (this.domainForm.get('notifications') as FormGroup).addControl(
        type.key,
        this.fb.control(false),
      );
    });
  }

  ngOnInit() {
    const domainName = this.route.snapshot.paramMap.get('domain-name');
    if (domainName) {
      this.loadDomain(domainName);
    } else {
      this.globalMessageService.showMessage({
        severity: 'error',
        summary: 'Error',
        detail: 'Domain not found',
      });
      this.router.navigate(['/domains']);
    }
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

  loadDomain(domainName: string) {
    this.databaseService.instance.getDomain(domainName).subscribe({
      next: (domain) => {
        this.domain = domain;
        this.populateForm();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          error,
          showToast: true,
          message: 'Failed to load domain',
          location: 'domain.Edit',
        });
        this.router.navigate(['/domains', this.domain!.domain_name]);
        this.isLoading = false;
      },
    });
  }

  /**
   * Filters registrars based on user input for autocomplete
   */
  public filterRegistrars(event: AutoCompleteCompleteEvent): void {
    this.filteredRegistrars = this.registrarAutocomplete.filterRegistrars(event.query);
  }

  get links(): FormArray {
    return this.domainForm.get('links') as FormArray;
  }

  populateForm() {
    this.domainForm.patchValue({
      registrar: this.domain!.registrar?.name,
      expiryDate: this.domain!.expiry_date ? new Date(this.domain!.expiry_date) : null,
      tags: this.domain!.tags,
      notes: this.domain!.notes,
      subdomains: this.domain!.sub_domains?.map((sd: { name: string }) => sd.name) || [],
    });

    // Set link values
    (this.domain!.domain_links || []).forEach((link) => {
      this.links.push(
        this.createLinkGroup(link.link_name, link.link_url, link.link_description),
      );
    });

    // Set notification values
    const notificationsFormGroup = this.domainForm.get('notifications') as FormGroup;
    (this.domain!.notification_preferences || []).forEach(
      (notification: { notification_type: string; is_enabled: boolean }) => {
        const notificationControl = notificationsFormGroup.get(
          notification.notification_type,
        );
        if (notificationControl) {
          notificationControl.setValue(notification.is_enabled);
        }
      },
    );
  }

  cleanSubdomain(subdomain: string): string {
    return subdomain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('.')[0];
  }

  onSubmit() {
    let links = this.links.value;
    try {
      links = links.map((link: Link) => {
        return {
          link_name: link.link_name,
          link_url: link.link_url,
          link_description: link.link_description,
        };
      });
    } catch (error) {
      this.errorHandler.handleError({
        error,
        showToast: true,
        message: 'Check link URL format',
        location: 'Edit Domain',
      });
      return;
    }
    if (this.domainForm.valid) {
      this.isLoading = true;
      const formValue = this.domainForm.value;

      const subdomains = formValue.subdomains.map((sd: string) => ({
        name: this.cleanSubdomain(sd),
      }));

      // Prepare updated domain data
      const updatedDomain: SaveDomainData = {
        domain: {
          domain_name: this.domain!.domain_name,
          registrar: formValue.registrar,
          expiry_date: formValue.expiryDate,
          notes: formValue.notes,
        },
        tags: formValue.tags,
        notifications: Object.entries(formValue.notifications).map(
          ([type, isEnabled]) => ({
            type,
            isEnabled: isEnabled as boolean,
          }),
        ),
        subdomains,
        links,
      };

      // Call the database service to update the domain
      this.databaseService.instance
        .updateDomain(this.domain!.id, updatedDomain)
        .subscribe({
          next: () => {
            this.globalMessageService.showMessage({
              severity: 'success',
              summary: 'Success',
              detail: 'Domain updated successfully',
            });
            this.isLoading = false;
            this.router.navigate(['/domains', this.domain!.domain_name]);
          },
          error: (err) => {
            this.errorHandler.handleError({
              error: err,
              message: 'Failed to update domain',
              showToast: true,
              location: 'Edit Domain',
            });
            this.isLoading = false;
          },
        });
    } else {
      this.globalMessageService.showMessage({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill all required fields correctly',
      });
    }
  }

  createLinkGroup(name = '', url = '', description = ''): FormGroup {
    return this.fb.group({
      link_name: [name, [Validators.required, Validators.maxLength(255)]],
      link_url: [
        url,
        [
          Validators.required,
          Validators.pattern(
            /^(https?:\/\/)?([\w.-]+\.[\w]{2,})(:\d+)?(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/,
          ),
        ],
      ],
      link_description: [description, [Validators.maxLength(255)]],
    });
  }

  addLink(): void {
    this.links.push(this.createLinkGroup());
  }

  removeLink(index: number): void {
    this.links.removeAt(index);
  }
}

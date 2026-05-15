import { Component, Input, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { PrimeNgModule } from '~/app/prime-ng.module';

import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { FeatureService } from '~/app/services/features.service';
import { Observable } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-add-subdomain-dialog',
  imports: [FormsModule, PrimeNgModule],
  template: `
    <p-dialog
      header="Add Subdomain"
      [(visible)]="display"
      [modal]="true"
      [closable]="true"
      (onHide)="onDialogHide()"
    >
      <div class="p-field">
        <label for="subdomainInput" class="block mb-2">Subdomain Name</label>
        <input
          id="subdomainInput"
          pInputText
          [(ngModel)]="subdomainInput"
          placeholder="Enter subdomain (e.g. 'api' or 'subdomain.example.com')"
          style="width: 100%"
        />
      </div>

      <p-footer>
        <button
          pButton
          label="Cancel"
          aria-label="Cancel"
          icon="pi pi-times"
          class="p-button-text mr-2"
          (click)="display = false"
        ></button>
        <button
          pButton
          label="Save"
          aria-label="Save"
          icon="pi pi-check"
          (click)="saveSubdomain()"
          [disabled]="!subdomainInput"
        ></button>
      </p-footer>
    </p-dialog>
  `,
})
export class AddSubdomainDialogComponent {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private globalMessagingService = inject(GlobalMessageService);
  private featureService = inject(FeatureService);

  /** The "parent" domain name, e.g. "example.com" */
  @Input() domain!: string;

  /** Whether dialog is visible or not */
  display = false;

  /** User input for new subdomain */
  subdomainInput = '';

  /** Programmatically show the dialog */
  showDialog() {
    this.display = true;
    this.subdomainInput = '';
  }

  /** Called when p-dialog is closed (X button or Cancel) */
  onDialogHide() {
    // Optionally reset stuff
    this.subdomainInput = '';
  }

  /**
   * Remove protocol, slash parts, invalid chars,
   * and anything after the first dot.
   */
  private sanitizeSubdomain(input: string): string {
    if (!input) return '';

    // Remove protocol: e.g. "http://", "https://"
    let sanitized = input.replace(/^https?:\/\//i, '');

    // If there is a slash, remove everything from the slash onward
    const slashIndex = sanitized.indexOf('/');
    if (slashIndex !== -1) {
      sanitized = sanitized.substring(0, slashIndex);
    }

    // If there's a dot, only keep text before the first dot
    const dotIndex = sanitized.indexOf('.');
    if (dotIndex !== -1) {
      sanitized = sanitized.substring(0, dotIndex);
    }

    // Remove all invalid characters for subdomain:
    sanitized = sanitized.replace(/[^a-zA-Z0-9-]/g, '');

    // Convert to lowercase (optional but common for subdomains)
    sanitized = sanitized.toLowerCase();

    return sanitized;
  }

  async saveSubdomain() {
    const cleanedSubdomain = this.sanitizeSubdomain(this.subdomainInput);
    if (!cleanedSubdomain) {
      this.globalMessagingService.showError(
        'Invalid subdomain',
        'Please enter a valid subdomain name.',
      );
      return;
    }

    if (!(await this.featureService.isFeatureEnabledPromise('writePermissions'))) {
      this.globalMessagingService.showWarn(
        'Write Permissions Disabled',
        "It's not possible to add subdomains on the demo instance.",
      );
      this.display = false;
      return;
    }

    // Call a new service method that inserts subdomain for domain
    const result$ =
      this.databaseService.instance.subdomainsQueries.saveSubdomainForDomain(
        this.domain,
        cleanedSubdomain,
      ) as Observable<unknown>;
    result$.subscribe({
      next: () => {
        this.globalMessagingService.showSuccess(
          'Subdomain Added',
          `${cleanedSubdomain}.${this.domain} has been successfully added to your account`,
        );
        this.display = false;

        // Option A: Trigger a reload from the parent
        // Option B: Add the new subdomain to the parent's list manually
      },
      error: (error: unknown) => {
        this.errorHandler.handleError({ error });
      },
    });
  }
}

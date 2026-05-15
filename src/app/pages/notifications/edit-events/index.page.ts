import { Component, OnInit, inject } from '@angular/core';
import DatabaseService from '~/app/services/database.service';
import { notificationTypes } from '~/app/constants/notification-types';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { MultiSelectModule } from 'primeng/multiselect';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { CommonModule } from '@angular/common';
import { DbDomain } from '~/app/../types/Database';
import { forkJoin } from 'rxjs';
import { FeatureService } from '~/app/services/features.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-notifications-edit-events-page',
  imports: [
    CommonModule,
    PrimeNgModule,
    MultiSelectModule,
    ReactiveFormsModule,
    FeatureNotEnabledComponent,
  ],
  templateUrl: './index.page.html',
})
export default class BulkNotificationPreferencesPage implements OnInit {
  private databaseService = inject(DatabaseService);
  private fb = inject(FormBuilder);
  private globalMessageService = inject(GlobalMessageService);
  private featureService = inject(FeatureService);
  private errorHandler = inject(ErrorHandlerService);

  notificationTypes = notificationTypes;
  domains: DbDomain[] = [];
  notificationPreferences: {
    domain_id: string;
    notification_type: string;
    is_enabled: boolean;
  }[] = [];
  notificationForm: FormGroup = this.fb.group({});
  loading = true;

  changeNotificationsFeatureEnabled$ =
    this.featureService.isFeatureEnabled('changeNotifications');

  ngOnInit() {
    this.loadDomainsAndPreferences();
  }

  private loadDomainsAndPreferences() {
    forkJoin({
      domains: this.databaseService.instance.listDomains(),
      preferences:
        this.databaseService.instance.notificationQueries.getNotificationPreferences(),
    }).subscribe({
      next: ({ domains, preferences }) => {
        this.domains = domains;
        this.notificationPreferences = preferences;

        // Set up form controls for each notification type
        this.notificationTypes.forEach((type) => {
          this.notificationForm.addControl(type.key, this.fb.control([]));
        });

        // Populate form values based on preferences
        this.notificationTypes.forEach((type) => {
          const enabledDomains = this.notificationPreferences
            .filter((pref) => pref.notification_type === type.key && pref.is_enabled)
            .map((pref) => pref.domain_id);
          this.notificationForm.get(type.key)?.setValue(enabledDomains);
        });

        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          error,
          message: 'Error loading domains or preferences',
          showToast: true,
          location: 'bulk-notification-preferences.page',
        });
      },
    });
  }

  async savePreferences() {
    try {
      // Collect notification preferences based on form values
      const preferences = this.notificationTypes.flatMap((type) => {
        const selectedDomains: string[] =
          this.notificationForm.get(type.key)?.value || [];
        return this.domains.map((domain) => ({
          domain_id: domain.id,
          notification_type: type.key,
          is_enabled: selectedDomains.includes(domain.id),
        }));
      });

      // Update preferences in the database
      await this.databaseService.instance.notificationQueries
        .updateBulkNotificationPreferences(preferences)
        .subscribe({
          next: () => {
            this.globalMessageService.showMessage({
              severity: 'success',
              summary: 'Success',
              detail: 'Notification Preferences Updated',
            });
          },
          error: (error) => {
            this.errorHandler.handleError({
              error,
              message: 'Error saving notification preferences',
              showToast: true,
              location: 'bulk-notification-preferences.page',
            });
          },
        });
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to save notification preferences',
        showToast: true,
        location: 'bulk-notification-preferences.page',
      });
    }
  }
}

import { Component, Input, inject, OnInit } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { SupabaseService } from '~/app/services/supabase.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { ConfirmationService } from 'primeng/api';
import { FeatureService } from '~/app/services/features.service';

interface DangerCard {
  title: string;
  body: string;
  buttonLabel: string;
  buttonLink?: string; // If button is a router link
  buttonFunction?: () => void; // Otherwise, if button is a function
  buttonIcon: string;
  buttonSeverity?: 'success' | 'info' | 'warning' | 'danger' | 'help' | 'primary';
  buttonClass?: string;
}

@Component({
  standalone: true,
  selector: 'app-delete-account',
  imports: [PrimeNgModule],
  templateUrl: './delete-data.component.html',
  styles: [``],
})
export class DeleteAccountComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private messageService = inject(GlobalMessageService);
  private errorHandler = inject(ErrorHandlerService);
  private confirmationService = inject(ConfirmationService);
  private featureService = inject(FeatureService);

  writePermissions = false;
  allowDataDeletion = false;
  @Input() isInPage = true;

  ngOnInit() {
    this.featureService.isFeatureEnabled('writePermissions').subscribe((isEnabled) => {
      this.writePermissions = isEnabled;
    });
    this.featureService.isFeatureEnabled('enableDeletionTool').subscribe((isEnabled) => {
      this.allowDataDeletion = isEnabled;
    });
  }

  dangerCards: DangerCard[] = [
    {
      title: 'Leave Feedback',
      body: "Considering closing your account, or facing issues with Domain Locker? We'd love to hear your feedback, so that we can improve.",
      buttonLabel: 'Leave Feedback',
      buttonLink: '/about/support/feedback',
      buttonIcon: 'pi pi-comment',
      buttonSeverity: 'success',
    },
    {
      title: 'Export Data',
      body: "If you wish to close your account, all data will be lost. It's recommended to export your data beforehand so you can more easily migrate to another service.",
      buttonLabel: 'Export Data',
      buttonLink: '/domains/export',
      buttonIcon: 'pi pi-download',
      buttonSeverity: 'info',
    },
    {
      title: 'Reset Settings',
      body: 'If you just want to clear your local settings and data, you can reset your settings here. This will not affect any of your domains, domain data or account info.',
      buttonLabel: 'Clear Data',
      buttonFunction: () => this.clearData(),
      buttonIcon: 'pi pi-eraser',
      buttonClass: 'bg-yellow-400 border-yellow-600 text-yellow-900',
    },
    {
      title: 'Cancel Billing',
      body: "If you're on a paid plan, you can cancel your subscription here. If you close your account, your subscription will be automatically cancelled.",
      buttonLabel: 'Cancel Subscription',
      buttonLink: '/settings/upgrade',
      buttonIcon: 'pi pi-wallet',
      buttonSeverity: 'warning',
    },
    {
      title: 'Delete Account',
      body: "If you're sure you want to delete your account, click the button below. All data will be lost and this action is irreversible.",
      buttonLabel: 'Delete Account',
      buttonFunction: () => this.confirmDeleteAccount(),
      buttonIcon: 'pi pi-trash',
      buttonSeverity: 'danger',
    },
    {
      title: 'Switch to Self-Hosted',
      body: "If you're interested in self-hosting, you can switch to the self-hosted version of the app. This will allow you to host the app on your own server and have full control over your data.",
      buttonLabel: 'Self-Hosting Docs',
      buttonLink: '/about/self-hosting',
      buttonIcon: 'pi pi-server',
      buttonSeverity: 'help',
    },
  ];

  clearData() {
    try {
      localStorage.clear();
      this.messageService.showSuccess(
        'Data Cleared',
        'Local storage has been cleared. You will be logged out.',
      );
      window.location.href = '/';
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to clear local storage',
        location: 'settings/account',
        showToast: true,
      });
    }
  }

  confirmDeleteAccount() {
    if (!this.writePermissions) {
      this.messageService.showWarn(
        'Feature not enabled',
        'You do not have permission to delete your account',
      );
      return;
    }
    if (!this.allowDataDeletion) {
      this.messageService.showWarn(
        'Data Deletion Disabled',
        'You do not have permission to delete your account',
      );
      return;
    }
    this.confirmationService.confirm({
      message:
        'Are you sure you want to delete your account and all associated?' +
        '<br><span class="text-red-400 font-bold">This action cannot be undone.</span>',
      header: 'Account Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-secondary p-button-sm',
      acceptIcon: 'pi pi-check-circle mr-2',
      rejectIcon: 'pi pi-times-circle mr-2',
      accept: () => {
        this.deleteAccount();
      },
    });
  }

  async deleteAccount() {
    try {
      this.supabaseService.user$.subscribe((user) => {
        const noDelete = ['dev@domain-locker.com', 'demo@domain-locker.com'];
        if (noDelete.includes(user?.email || '')) {
          this.messageService.showError(
            'Cannot delete account',
            'This account is a demo account and cannot be deleted',
          );
          return;
        }
      });
      await this.supabaseService.deleteAccount();
      this.messageService.showSuccess(
        'Account Deleted',
        'Your account has been permanently deleted, and all data wiped',
      );
      this.supabaseService.signOut();
      window.location.href = '/';
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to delete account',
        location: 'settings/account',
        showToast: true,
      });
    }
  }
}

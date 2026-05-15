import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseService } from '~/app/services/supabase.service';
import { User } from '@supabase/supabase-js';

import { GlobalMessageService } from '~/app/services/messaging.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { FeatureService } from '~/app/services/features.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';

@Component({
  standalone: true,
  selector: 'app-settings-account-page',
  templateUrl: './account.page.html',
  styleUrls: ['./index.page.scss'],
  imports: [PrimeNgModule, ReactiveFormsModule, FeatureNotEnabledComponent],
  providers: [MessageService, ConfirmationService],
})
export default class UserSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private messageService = inject(GlobalMessageService);
  private errorHandler = inject(ErrorHandlerService);
  private confirmationService = inject(ConfirmationService);
  private cdr = inject(ChangeDetectorRef);
  private featureService = inject(FeatureService);

  // Forms
  profileForm!: FormGroup;
  emailForm!: FormGroup;
  passwordForm!: FormGroup;
  mfaForm!: FormGroup;
  sessionForm!: FormGroup;

  // User data
  user: User | null = null;

  // Password data
  hasPassword = false;

  // MFA data
  mfaEnabled = false;
  qrCode: string | null = null;
  secret: string | null = null;
  verified = false;
  showResetMfaButton = false;
  factorId: string | null = null;
  challengeId: string | null = null;

  // Monitoring loading states
  loading = {
    profile: false,
    email: false,
    password: false,
    mfa: false,
    session: false,
    backupCodes: false,
    exportData: false,
    deleteAccount: false,
  };

  isEnabled = true;
  writePermissions = true;

  ngOnInit() {
    this.initializeForms();
    this.loadUserData();
    this.checkIfUserHasPassword().then((hasPassword) => {
      this.hasPassword = hasPassword;
      this.updatePasswordForm(hasPassword);
      this.cdr.detectChanges(); // Ensures the UI updates
    });
    this.checkMFAStatus();

    this.featureService.isFeatureEnabled('writePermissions').subscribe((isEnabled) => {
      this.writePermissions = isEnabled;
    });
  }

  initializeForms() {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.profileForm = this.fb.group({
      name: ['', [Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9\s\-_]+$/)]],
      avatar_url: [
        '',
        [Validators.pattern(/^(https?:\/\/(?:www\.)?[a-zA-Z0-9.\-_]+(?:\/[^\s]*)?)$/)],
      ],
    });

    this.passwordForm = this.fb.group(
      {
        ...(this.hasPassword && { currentPassword: ['', Validators.required] }),
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );

    this.mfaForm = this.fb.group({
      otpCode: [
        '',
        [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
      ],
    });

    this.sessionForm = this.fb.group({
      sessionTimeout: ['', [Validators.required, Validators.min(1)]],
    });
  }

  async loadUserData() {
    this.loading.profile = true;
    try {
      this.user = await this.supabaseService.getCurrentUser();
      if (!this.user) return;
      this.emailForm.patchValue({ email: this.user.email });
      const meta = this.user.user_metadata || {};
      this.profileForm.patchValue({
        name: meta['name'] || meta['full_name'] || '',
        avatar_url: meta['avatar_url'] || '',
      });
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Unable to fetch user metadata',
        location: 'settings/account',
        showToast: true,
      });
    } finally {
      this.loading.profile = false;
    }
  }

  updatePasswordForm(hasPassword: boolean) {
    if (hasPassword) {
      this.passwordForm.addControl(
        'currentPassword',
        this.fb.control('', Validators.required),
      );
    } else {
      this.passwordForm.removeControl('currentPassword');
    }
  }

  /* Returns true if user has email + password (aka not social login) */
  async checkIfUserHasPassword(): Promise<boolean> {
    const sessionData = (await this.supabaseService.getSessionData()) as {
      session?: { user?: User };
    };
    const identities = sessionData?.session?.user?.identities || [];

    // If the user has an email identity, they definitely have a password
    const emailIdentity = identities.find((identity) => identity.provider === 'email');
    if (emailIdentity) {
      return true;
    }

    // Otherwise, check the `has_password` flag in user metadata
    const userMetadata = sessionData?.session?.user?.user_metadata || {};
    return !!userMetadata['has_password'];
  }

  async updateProfile() {
    if (!this.writePermissions) {
      this.messageService.showWarn(
        'Feature not enabled',
        'You do not have permission to update your profile',
      );
      return;
    }
    if (this.profileForm.valid) {
      this.loading.profile = true;
      try {
        await this.supabaseService.updateUserMetadata(this.profileForm.value);
        this.messageService.showSuccess('Profile updated successfully', '');
      } catch (error) {
        this.errorHandler.handleError({
          error,
          message: 'Failed to update profile',
          location: 'settings/account',
          showToast: true,
        });
      } finally {
        this.loading.profile = false;
      }
    }
  }

  async updateEmail() {
    if (!this.writePermissions) {
      this.messageService.showWarn(
        'Feature not enabled',
        'You do not have permission to update your email',
      );
      return;
    }
    if (this.emailForm.valid) {
      this.loading.email = true;
      try {
        await this.supabaseService.updateEmail(this.emailForm.get('email')!.value);
        this.messageService.showSuccess('Update Complete', 'Your email has been updated');
      } catch (error) {
        this.errorHandler.handleError({
          error,
          message: 'Failed to update email',
          location: 'settings/account',
          showToast: true,
        });
      } finally {
        this.loading.email = false;
      }
    }
  }

  async updatePassword() {
    if (!this.writePermissions) {
      this.messageService.showWarn(
        'Feature not enabled',
        'You do not have permission to update your password',
      );
      return;
    }
    if (this.passwordForm.valid) {
      this.loading.password = true;
      try {
        if (this.hasPassword) {
          await this.supabaseService.updatePassword(
            this.passwordForm.get('currentPassword')!.value,
            this.passwordForm.get('newPassword')!.value,
          );
          this.messageService.showSuccess(
            'Password Updated',
            'You may now login with your new password',
          );
        } else {
          await this.supabaseService.setPassword(
            this.passwordForm.get('newPassword')!.value,
          );
          this.messageService.showSuccess(
            'Password Set',
            'You can now login with email/password',
          );
        }
        this.passwordForm.reset();
      } catch (error) {
        this.errorHandler.handleError({
          error,
          message: (error as Error)?.message || 'Failed to set/update password',
          location: 'settings/account',
          showToast: true,
        });
      } finally {
        this.loading.password = false;
      }
    }
  }

  async checkMFAStatus(): Promise<void> {
    try {
      this.mfaEnabled = await this.supabaseService.isMFAEnabled();
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to check MFA status',
        location: 'settings/mfa',
        showToast: true,
      });
    }
  }

  async startEnableMFA(): Promise<void> {
    if (!this.writePermissions) {
      this.messageService.showWarn(
        'Feature not enabled',
        'You do not have permission to enable MFA',
      );
      return;
    }
    this.loading.mfa = true;
    try {
      const { qrCode, secret, factorId, challengeId } =
        await this.supabaseService.enableMFA();
      this.qrCode = qrCode;
      this.secret = secret;
      this.factorId = factorId; // Save factorId for verification
      this.challengeId = challengeId; // Save challengeId for verification
      this.mfaEnabled = true;
      this.messageService.showInfo(
        'Scan the QR Code',
        'Please scan the QR code with your authenticator app and verify it.',
      );
      this.showResetMfaButton = true;
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to enable MFA',
        location: 'settings/mfa',
        showToast: true,
      });
      this.showResetMfaButton = true;
    } finally {
      this.loading.mfa = false;
    }
  }

  async enableMFA(): Promise<void> {
    if (!this.writePermissions) {
      this.messageService.showWarn(
        'Feature not enabled',
        'You do not have permission to enable MFA',
      );
      return;
    }
    this.loading.mfa = true;
    try {
      const { qrCode } = await this.supabaseService.enableMFA();
      this.qrCode = qrCode;
      this.messageService.showInfo(
        'Scan the QR Code',
        'Please scan the QR code with your authenticator app and verify it.',
      );
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to enable MFA',
        location: 'settings/mfa',
        showToast: true,
      });
    } finally {
      this.loading.mfa = false;
    }
  }

  async verifyMFA(): Promise<void> {
    this.loading.mfa = true;
    try {
      if (!this.factorId || !this.challengeId) {
        throw new Error('MFA setup is incomplete. Please enable MFA again.');
      }
      const code = this.mfaForm.get('otpCode')!.value;
      await this.supabaseService.verifyMFA2WithChallenge(
        this.factorId,
        this.challengeId,
        code,
      );
      this.verified = true;
      this.messageService.showSuccess(
        'MFA Enabled',
        'Your two-factor authentication is now active.',
      );
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to verify MFA',
        location: 'settings/mfa',
        showToast: true,
      });
    } finally {
      this.loading.mfa = false;
    }
  }

  async disableMFA(): Promise<void> {
    if (!this.writePermissions) {
      this.messageService.showWarn(
        'Feature not enabled',
        'You do not have permission to disable MFA',
      );
      return;
    }
    this.loading.mfa = true;
    try {
      await this.supabaseService.disableMFA();
      this.mfaEnabled = false;
      this.qrCode = null;
      this.verified = false;
      this.messageService.showSuccess(
        'MFA Disabled',
        'Multi-Factor Authentication has been disabled.',
      );
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to disable MFA',
        location: 'settings/mfa',
        showToast: true,
      });
    } finally {
      this.loading.mfa = false;
    }
  }

  async resetMFA(): Promise<void> {
    this.loading.mfa = true;
    try {
      await this.supabaseService.disableMFA();
      this.qrCode = null;
      this.secret = null;
      this.verified = false;
      this.mfaEnabled = false;
      this.messageService.showInfo('MFA Reset', 'You can now re-enable MFA.');
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to reset MFA',
        location: 'settings/mfa',
        showToast: true,
      });
    } finally {
      this.loading.mfa = false;
    }
  }

  async downloadBackupCodes() {
    this.loading.backupCodes = true;
    try {
      await this.supabaseService.getBackupCodes();
      // Implement logic to download codes as a file
      this.messageService.showSuccess(
        'Backup codes downloaded',
        'Be sure to store them in a safe place',
      );
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to download backup codes',
        location: 'settings/account',
        showToast: true,
      });
    } finally {
      this.loading.backupCodes = false;
    }
  }

  async updateSessionTimeout() {
    if (this.sessionForm.valid) {
      this.loading.session = true;
      this.errorHandler.handleError({
        message: 'Method not yet implemented',
        location: 'settings/account',
        showToast: true,
      });
      this.loading.session = false;
    }
  }

  async exportData() {
    this.loading.exportData = true;
    try {
      await this.supabaseService.exportUserData();
      // Implement logic to download data as a file
      this.messageService.showSuccess('Data exported', 'Your data has been downloaded');
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to export data',
        location: 'settings/account',
        showToast: true,
      });
    } finally {
      this.loading.exportData = false;
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
    this.loading.deleteAccount = true;
    try {
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
    } finally {
      this.loading.deleteAccount = false;
    }
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }
}

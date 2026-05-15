import {
  Component,
  OnInit,
  ChangeDetectorRef,
  PLATFORM_ID,
  ViewChild,
  inject,
  OnDestroy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '~/app/services/supabase.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { Subscription } from 'rxjs';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { FeatureService } from '~/app/services/features.service';
import { EnvService } from '~/app/services/environment.service';
import { HitCountingService } from '~/app/services/hit-counting.service';
import { LogoComponent } from '~/app/components/home-things/logo/logo.component';
import { NgxTurnstileModule, NgxTurnstileComponent } from 'ngx-turnstile';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    PrimeNgModule,
    LogoComponent,
    NgxTurnstileModule,
  ],
  templateUrl: './login.page.html',
  styles: [
    `
      :host ::ng-deep .p-selectbutton {
        display: flex;
        margin-bottom: 1rem;
      }
      :host ::ng-deep .p-selectbutton .p-button {
        flex: 1;
      }
    `,
  ],
})
export default class LoginPageComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private messagingService = inject(GlobalMessageService);
  private errorHandlerService = inject(ErrorHandlerService);
  private featureService = inject(FeatureService);
  private environmentService = inject(EnvService);
  private hitCountingService = inject(HitCountingService);
  private platformId = inject<object>(PLATFORM_ID);

  isLogin = true;
  form: FormGroup;
  errorMessage = '';
  successMessage = '';
  showLoader = false;
  showWelcomeCard = false;
  isAuthenticated = false;
  showResendEmail = false;
  showPasswordResetForm = false;
  showNewPasswordSetForm = false;
  disabled = false;
  modes = [
    { label: 'Login', value: true },
    { label: 'Sign Up', value: false },
  ];

  requireMFA = false;
  factorId: string | null = null;
  challengeId: string | null = null;
  partialSession: unknown;
  isDemoInstance = false;

  @ViewChild(NgxTurnstileComponent) turnstile!: NgxTurnstileComponent;
  turnstileResponse?: string;
  turnstileSiteKey = '';

  private subscriptions: Subscription = new Subscription();

  enableSocialLogin$ = this.featureService.isFeatureEnabled('enableSocialLogin');

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
      mfaCode: ['', [Validators.pattern(/^\d{6}$/)]],
      acceptTerms: [false],
    });

    this.turnstileSiteKey = this.environmentService.getEnvVar('DL_TURNSTILE_KEY') || '';
  }

  ngOnInit() {
    this.onModeChange();

    this.subscriptions.add(
      this.supabaseService.authState$.subscribe((isAuthenticated) => {
        this.isAuthenticated = isAuthenticated;
        this.cdr.detectChanges();
      }),
    );

    // Initial check for auth status
    this.checkAuthStatus();

    // If demo instance, show banner and auto-fill credentials
    this.checkIfDemoInstance();

    // Show signup form and welcome immediately if newUser query param is present
    const isNewSignup = this.route.snapshot.queryParamMap.get('newUser');
    if (isNewSignup !== null) {
      this.isLogin = false;
      this.showWelcomeCard = true;
      this.checkIfSignupDisabled();
    }

    // Show enter new password form if reset password query param is present
    const isResetPassword = this.route.snapshot.queryParamMap.get('reset');
    if (isResetPassword) {
      this.showPasswordResetForm = true;
      this.showNewPasswordSetForm = true;
    }

    this.route.queryParams.subscribe(async (params) => {
      if (params['requireMFA'] === 'true') {
        // User needs to complete MFA
        const { data: factors } =
          await this.supabaseService.supabase.auth.mfa.listFactors();
        if (factors && factors.totp.length > 0) {
          this.requireMFA = true;
          this.factorId = factors.totp[0].id;
          this.form
            .get('mfaCode')
            ?.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
          this.form.get('mfaCode')?.updateValueAndValidity();
          this.successMessage = 'Please enter your 2FA code to continue';
          this.cdr.detectChanges();
        }
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  togglePasswordResetForm() {
    this.showPasswordResetForm = !this.showPasswordResetForm;
    this.resetMessages();
  }

  /**
   * Complete the password reset flow by setting the new password.
   * This method was updated to call SupabaseService.setPassword(...)
   * and handle success/error messages appropriately.
   */
  async saveUpdatedPassword() {
    this.resetMessages();
    this.showLoader = true;
    const newPassword = this.form.get('password')?.value;

    if (!newPassword) {
      this.errorMessage = 'Please enter a valid new password.';
      this.showLoader = false;
      return;
    }

    try {
      await this.supabaseService.setPassword(newPassword);
      this.successMessage =
        'Your password has been updated. Please log in with your new password.';
      this.showNewPasswordSetForm = false;
    } catch (error) {
      this.errorMessage =
        (error as Error)?.message || 'Failed to set new password. Please try again.';
    } finally {
      this.showLoader = false;
    }
  }

  sendCaptchaResponse(captchaResponse: string | null) {
    this.turnstileResponse = captchaResponse || undefined;
  }

  async checkAuthStatus() {
    const isAuthenticated = await this.supabaseService.isAuthenticated();
    this.supabaseService.setAuthState(isAuthenticated);
  }

  /* Update form visibility, and clear messages on mode change */
  async onModeChange() {
    // Reset error/success messages
    this.resetMessages();

    // Reset MFA state
    this.requireMFA = false;
    this.factorId = null;
    this.challengeId = null;
    this.form.get('mfaCode')?.reset();

    // Reset form validators based on mode
    if (this.isLogin) {
      this.form.get('confirmPassword')?.clearValidators();
      this.form.get('acceptTerms')?.clearValidators();
    } else {
      this.checkIfSignupDisabled();
      this.form
        .get('confirmPassword')
        ?.setValidators([Validators.required, this.passwordMatchValidator.bind(this)]);
      this.form.get('acceptTerms')?.setValidators([Validators.requiredTrue]);
    }
    this.form.get('confirmPassword')?.updateValueAndValidity();
    this.form.get('acceptTerms')?.updateValueAndValidity();
  }

  async checkIfSignupDisabled() {
    if (!(await this.featureService.isFeatureEnabledPromise('enableSignUp'))) {
      this.messagingService.showWarn(
        'Sign Up Disabled',
        "It's not possible to create new accounts on the demo instance.",
      );
      this.isLogin = true;
    }
  }

  checkIfDemoInstance() {
    const environmentType = this.environmentService.getEnvironmentType();
    if (environmentType === 'demo') {
      this.isDemoInstance = true;
    }
    if (environmentType === 'demo' || environmentType === 'dev') {
      // Pre-fill demo/dev credentials if they exist
      const demoUser = this.environmentService.getEnvVar('DL_DEMO_USER') || '';
      const demoPass = this.environmentService.getEnvVar('DL_DEMO_PASS') || '';
      this.form.get('email')?.setValue(demoUser);
      this.form.get('password')?.setValue(demoPass);
    }
  }

  passwordMatchValidator(control: AbstractControl): Record<string, boolean> | null {
    const password = this.form.get('password')?.value;
    const confirmPassword = control.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  signOut() {
    this.hitCountingService.trackEvent('auth_logout', { location: 'login' });
    this.supabaseService.signOut();
  }

  private resetMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  async loginWithGitHub(): Promise<void> {
    try {
      this.hitCountingService.trackEvent('auth_login_start', {
        method: 'social',
        provider: 'github',
      });
      await this.supabaseService.signInWithGitHub();
    } catch (error) {
      this.errorHandlerService.handleError({
        error,
        message: 'Failed to sign in with GitHub',
        showToast: true,
        location: 'login',
      });
    }
  }

  async loginWithGoogle(): Promise<void> {
    try {
      this.hitCountingService.trackEvent('auth_login_start', {
        method: 'social',
        provider: 'google',
      });
      await this.supabaseService.signInWithGoogle();
    } catch (error) {
      this.errorHandlerService.handleError({
        error,
        message: 'Failed to sign in with Google',
        showToast: true,
        location: 'loginWithGoogle',
      });
    }
  }

  async loginWithFacebook(): Promise<void> {
    try {
      this.hitCountingService.trackEvent('auth_login_start', {
        method: 'social',
        provider: 'facebook',
      });
      await this.supabaseService.signInWithFacebook();
    } catch (error) {
      this.errorHandlerService.handleError({
        error,
        message: 'Failed to sign in with Facebook',
        showToast: true,
        location: 'loginWithFacebook',
      });
    }
  }

  async sendPasswordResetEmail() {
    this.resetMessages();
    this.showLoader = true;
    this.hitCountingService.trackEvent('auth_password_reset_start');
    try {
      const email = this.form.get('email')?.value;
      if (!email) {
        throw new Error('Email is required.');
      }
      await this.supabaseService.sendPasswordResetEmail(email);
      this.successMessage = 'Password reset email sent successfully.';
      this.errorMessage = '';
      this.showPasswordResetForm = false;
    } catch (error) {
      this.errorMessage =
        (error as Error)?.message ||
        'Failed to send password reset email. Please try again.';
      this.successMessage = '';
    } finally {
      this.showLoader = false;
    }
  }

  async onSubmit() {
    if (!this.form.valid || (this.requireMFA && this.form.get('mfaCode')?.invalid))
      return;

    this.resetMessages();
    this.showLoader = true;

    try {
      const credentials = {
        email: this.form.get('email')?.value,
        password: this.form.get('password')?.value,
        mfaCode: this.form.get('mfaCode')?.value,
      };

      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required.');
      }

      if (this.isLogin) {
        await this.performLogin(credentials);
      } else {
        await this.performSignUp(credentials);
      }
    } catch (error) {
      this.handleError(error);
      this.turnstile.reset();
    } finally {
      this.showLoader = false;
    }
  }

  private async performLogin(credentials: {
    email: string;
    password: string;
    mfaCode?: string;
  }): Promise<void> {
    this.hitCountingService.trackEvent('auth_login_start', { method: 'email' });
    if (this.requireMFA && credentials.mfaCode) {
      await this.verifyMFACode(credentials.mfaCode);
    } else {
      await this.initialLoginAttempt(credentials);
    }
  }

  private async verifyMFACode(mfaCode: string): Promise<void> {
    if (!this.factorId) {
      throw new Error('No factor ID available');
    }

    await this.supabaseService.verifyMFA(this.factorId, mfaCode);
    this.requireMFA = false;
    this.handleSuccess();
  }

  private async initialLoginAttempt(credentials: {
    email: string;
    password: string;
  }): Promise<void> {
    const { requiresMFA, factors } = await this.supabaseService.signIn(
      credentials.email,
      credentials.password,
      this.turnstileResponse,
    );

    if (requiresMFA && factors.length > 0) {
      await this.setupMFAVerification(factors[0].id);
    } else {
      this.handleSuccess();
    }
  }

  private async setupMFAVerification(factorId: string): Promise<void> {
    this.requireMFA = true;
    this.factorId = factorId;

    this.form
      .get('mfaCode')
      ?.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
    this.form.get('mfaCode')?.updateValueAndValidity();

    this.successMessage = 'Please enter your 2FA code to continue';
    this.cdr.detectChanges();
  }

  private async performSignUp(credentials: {
    email: string;
    password: string;
  }): Promise<void> {
    this.hitCountingService.trackEvent('auth_signup_start', { method: 'email' });
    const delayTimeout = 15000;
    const authPromise = this.supabaseService.signUp(
      credentials.email,
      credentials.password,
      this.turnstileResponse,
    );
    const timeoutPromise = this.createTimeout(delayTimeout);

    const result = await Promise.race([authPromise, timeoutPromise]);
    if (result instanceof Error) {
      throw result;
    }

    this.handleSuccess();
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), ms);
    });
  }

  private handleSuccess() {
    if (this.requireMFA) {
      this.successMessage =
        '2FA verification is enabled. Please enter your code when prompted.';
    } else if (this.isLogin) {
      this.hitCountingService.trackEvent('auth_login_done', { method: 'email' });
      this.successMessage = 'Login successful! Redirecting...';
      this.router.navigate(['/']);
    } else {
      this.hitCountingService.trackEvent('auth_signup_done', { method: 'email' });
      this.messagingService.showSuccess(
        'Sign Up Successful',
        'Awaiting account confirmation...',
      );
      this.successMessage =
        'Sign up successful! Please check your email to confirm your account.';
      this.disabled = true;
    }
    this.cdr.detectChanges();
  }

  private handleError(error: unknown) {
    if (error instanceof Error) {
      this.errorMessage = error.message;
      if (error.message.includes('Email not confirmed')) {
        this.showResendEmail = true;
      }
    } else {
      this.errorMessage = 'An unexpected error occurred. Please try again.';
    }
    this.cdr.detectChanges();
  }

  public resendVerificationEmail() {
    this.showLoader = true;
    try {
      this.supabaseService.resendVerificationEmail(this.form.get('email')?.value);
      this.successMessage = 'Verification email resent successfully.';
      this.errorMessage = '';
      this.showResendEmail = false;
      this.showLoader = false;
    } catch {
      this.errorMessage = 'Failed to resend verification email. Please try again.';
      this.showLoader = false;
    }
  }
}

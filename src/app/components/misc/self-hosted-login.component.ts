import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { LogoComponent } from '~/app/components/home-things/logo/logo.component';
import { AuthService } from '~/app/services/auth.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { ApiRequestError } from '~/app/services/db-query-services/api/api-client';

/** Password sign-in for a self-hosted instance running with DL_AUTH_PASSWORD */
@Component({
  standalone: true,
  selector: 'app-self-hosted-login',
  imports: [ReactiveFormsModule, PrimeNgModule, LogoComponent],
  template: `
    <p-card styleClass="max-w-[500px] w-[calc(100%-0.5rem)]">
      <ng-template pTemplate="header">
        <div class="flex gap-2 items-center p-4 pb-0">
          <app-logo />
          <h2 class="m-0">Sign In</h2>
        </div>
      </ng-template>

      @if (checking) {
        <p class="m-0 opacity-70">Checking whether this instance needs a password...</p>
      } @else if (!authRequired) {
        <p class="m-0">
          This instance isn't password protected, so there's nothing to sign in to. Set
          <code>DL_AUTH_PASSWORD</code> to require one.
        </p>
        <p-button
          label="Go to my domains"
          icon="pi pi-arrow-right"
          routerLink="/domains"
          styleClass="mt-3"
        />
      } @else if (authenticated) {
        <p class="m-0">You're signed in.</p>
        <div class="flex gap-2 mt-3">
          <p-button
            label="Go to my domains"
            icon="pi pi-arrow-right"
            routerLink="/domains"
          />
          <p-button
            label="Sign out"
            icon="pi pi-sign-out"
            severity="secondary"
            [outlined]="true"
            (click)="signOut()"
          />
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="signIn()" class="flex flex-col gap-3">
          <label for="instance-password" class="text-sm opacity-70">
            This instance is password protected
          </label>
          <input
            id="instance-password"
            pInputText
            type="password"
            formControlName="password"
            autocomplete="current-password"
            placeholder="Password"
            class="w-full"
          />
          @if (errorMessage) {
            <small class="text-red-400">{{ errorMessage }}</small>
          }
          <p-button
            type="submit"
            label="Sign In"
            icon="pi pi-sign-in"
            [loading]="submitting"
            [disabled]="form.invalid"
            styleClass="w-full justify-center"
          />
        </form>
      }
    </p-card>
  `,
})
export class SelfHostedLoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  form = this.fb.nonNullable.group({
    password: ['', Validators.required],
  });

  checking = true;
  authRequired = false;
  authenticated = false;
  submitting = false;
  errorMessage = '';

  async ngOnInit(): Promise<void> {
    try {
      const status = await this.auth.status();
      this.authRequired = status.authRequired;
      this.authenticated = status.authenticated;
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Could not reach this instance to check whether it needs a password',
        location: 'SelfHostedLoginComponent',
      });
    } finally {
      this.checking = false;
      this.cdr.detectChanges();
    }
  }

  signIn(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    this.errorMessage = '';
    this.auth.login(this.form.getRawValue().password).subscribe({
      // A reload lets every service pick the session up, rather than half the app
      next: () => window.location.assign('/domains'),
      error: (error: unknown) => {
        this.submitting = false;
        this.errorMessage =
          error instanceof ApiRequestError && error.code === 'unauthorized'
            ? 'Incorrect password'
            : 'Could not sign in, please try again';
        this.cdr.detectChanges();
      },
    });
  }

  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      window.location.reload();
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Could not sign out',
        showToast: true,
        location: 'SelfHostedLoginComponent',
      });
    }
  }
}

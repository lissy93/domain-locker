import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService } from '~/app/services/supabase.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { HitCountingService } from '~/app/services/hit-counting.service';

@Component({
  standalone: true,
  selector: 'app-auth-callback-page',
  template: `<p>Processing social login...</p>`,
})
export default class AuthCallbackComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private messagingService = inject(GlobalMessageService);
  private errorHandlerService = inject(ErrorHandlerService);
  private hitCountingService = inject(HitCountingService);
  private platformId = inject<object>(PLATFORM_ID);

  private errorHappened(error: Error | unknown) {
    this.errorHandlerService.handleError({
      message: 'Unable to authenticate with your social account',
      error,
      location: 'auth-callback',
    });
    this.router.navigate(['/login']);
  }

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const { data: _data, error } =
        await this.supabaseService.supabase.auth.exchangeCodeForSession(
          window.location.href,
        );
      if (error) {
        this.errorHappened(error);
        return;
      }
    } catch (error) {
      this.errorHappened(error);
      return;
    }

    // Successfully logged in
    this.hitCountingService.trackEvent('auth_login_done', { method: 'social' });
    this.messagingService.showSuccess('Authenticated', 'Successfully logged in');
    this.router.navigate(['/']);
  }
}

import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  from,
  lastValueFrom,
  map,
  Observable,
  throwError,
} from 'rxjs';
import { SupabaseService } from '~/app/services/supabase.service';
import { EnvService } from '~/app/services/environment.service';
import { ErrorHandlerService } from '~/app/services//error-handler.service';
import { HttpClient } from '@angular/common/http';

/**
 * Environment Types
 */
export type BillingPlans = 'free' | 'hobby' | 'pro' | 'enterprise';
export type SpecialPlans =
  | 'sponsor'
  | 'complimentary'
  | 'tester'
  | 'demo'
  | 'super'
  | 'local';
export type UserType = BillingPlans | SpecialPlans;
type EnvironmentType = 'dev' | 'managed' | 'selfHosted' | 'demo';

@Injectable({
  providedIn: 'root',
})
export class BillingService {
  private supabaseService = inject(SupabaseService);
  private envService = inject(EnvService);
  private errorHandler = inject(ErrorHandlerService);
  private http = inject(HttpClient);

  private userPlan$ = new BehaviorSubject<UserType | null>(null);
  private environmentType: EnvironmentType;

  constructor() {
    this.environmentType = this.envService.getEnvironmentType();
  }

  /**
   * Fetches and caches the user's current plan from the database.
   */
  async fetchUserPlan(): Promise<void> {
    const envType = this.environmentType;

    if (envType === 'selfHosted') {
      this.userPlan$.next('super');
      return;
    } else if (envType === 'dev') {
      this.userPlan$.next('tester');
      return;
    } else if (envType === 'demo') {
      this.userPlan$.next('demo');
      return;
    }

    if (!this.envService.isSupabaseEnabled()) {
      this.userPlan$.next('local');
      return;
    }

    try {
      const user = await this.supabaseService.getCurrentUser();

      if (!user) {
        this.userPlan$.next(null);
        return;
      }

      // Fetch user plan from `user_info`
      const { data, error } = await this.supabaseService.getUserBillingInfo();
      if (error || !data?.['current_plan']) {
        this.errorHandler.handleError({
          error,
          message: 'Failed to fetch billing info',
          location: 'billing service',
        });
        this.userPlan$.next('free');
        return;
      }
      this.userPlan$.next(data['current_plan'] as UserType);
    } catch (error) {
      this.errorHandler.handleError({
        error,
        location: 'billing service',
        message: 'Unable to verify billing plan, fallback to free plan',
      });
      this.userPlan$.next('free');
    }
  }

  /**
   * Returns an observable of the user's current plan.
   */
  getUserPlan(): Observable<UserType | null> {
    return this.userPlan$.asObservable();
  }

  /** Returns an Observable that emits the user's billing row or throws an error. */
  getBillingData(): Observable<Record<string, unknown> | null> {
    return from(this.supabaseService.supabase.from('billing').select('*').single()).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }
        return data as Record<string, unknown> | null;
      }),
      catchError((err) => throwError(() => err)),
    );
  }

  async cancelSubscription(): Promise<{ error?: string } & Record<string, unknown>> {
    const userId = (await this.supabaseService.getCurrentUser())?.id;
    const endpoint = this.envService.getEnvVar('DL_STRIPE_CANCEL_URL');
    if (!endpoint) {
      throw new Error('Stripe cancel endpoint is not configured.');
    }

    try {
      // interceptor will add Authorization header for supabase functions
      const data = await lastValueFrom(
        this.http.post<{ error?: string } & Record<string, unknown>>(endpoint, {
          userId,
        }),
      );
      if (data.error) {
        throw new Error(data.error);
      }
      return data;
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to cancel subscription',
        showToast: true,
        location: 'SupabaseService.cancelSubscription',
      });
      throw error;
    }
  }

  async createCheckoutSession(productId: string): Promise<string> {
    const userId = (await this.supabaseService.getCurrentUser())?.id;
    const endpoint = this.envService.getEnvVar('DL_STRIPE_CHECKOUT_URL', null, true);
    const host = this.envService.getEnvVar('DL_BASE_URL', 'https://domain-locker.com');
    const callbackUrl = host
      ? `${host}/settings/upgrade`
      : typeof window !== 'undefined'
        ? window.location.href
        : '';

    if (!endpoint) {
      throw new Error('Stripe checkout endpoint is not configured.');
    }

    try {
      const body = { userId, productId, callbackUrl };
      // interceptor will attach JWT
      const data = await lastValueFrom(
        this.http.post<{ url?: string; error?: string }>(endpoint, body),
      );
      if (!data.url) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
      return data.url;
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to create checkout session',
        showToast: true,
        location: 'SupabaseService.createCheckoutSession',
      });
      throw error;
    }
  }

  verifyStripeSession(sessionId: string) {
    this.http
      .post<{ status?: string }>('/api/verify-checkout', { sessionId })
      .subscribe((res) => {
        if (res && res.status === 'paid') {
          // Payment is confirmed, plan is 'pro' or 'hobby', etc.
          // Now you can either refresh the user plan from DB or fallback if webhooks fail
        } else {
          // Payment not actually successful
        }
      });
  }
}

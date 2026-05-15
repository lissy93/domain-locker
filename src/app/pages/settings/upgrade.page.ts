import { Component, OnInit, PLATFORM_ID, NgZone, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { BillingService } from '~/app/services/billing.service';
import { pricingFeatures } from '~/app/constants/pricing-features';
import { Observable } from 'rxjs';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ConfirmationService } from 'primeng/api';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { EnvService } from '~/app/services/environment.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';
import { FeatureService } from '~/app/services/features.service';
import { SupabaseService } from '~/app/services/supabase.service';

interface BillingInfo {
  next_payment_due?: string;
  meta?: { invoice_pdf?: string };
  [key: string]: unknown;
}

interface SubscriptionData {
  customer_id: string;
  status: string;
  subscription_id: string;
  plan: string;
  current_period_start: string; // ISO 8601 Date string
  current_period_end: string; // ISO 8601 Date string
  cancel_at: string | null; // Nullable ISO 8601 Date string
  cancel_at_period_end: boolean;
  discount?: {
    percent_off: number;
    name: string;
    duration: string;
  };
  invoices: {
    amount_paid: number;
    currency: string;
    status: string;
    number: string;
    hosted_invoice_url: string;
    invoice_pdf: string;
    date: string; // ISO 8601 Date string
  }[];
  payment_method: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

@Component({
  selector: 'app-settings-upgrade-page',
  standalone: true,
  imports: [CommonModule, PrimeNgModule, FeatureNotEnabledComponent],
  templateUrl: './upgrade.page.html',
  styles: [
    `
      ::ng-deep .p-confirm-dialog {
        max-width: 600px;
      }
      ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
        padding: 0.5rem;
      }
    `,
  ],
})
export default class UpgradePage implements OnInit {
  private billingService = inject(BillingService);
  private errorHandler = inject(ErrorHandlerService);
  private route = inject(ActivatedRoute);
  private confirmationService = inject(ConfirmationService);
  private messagingService = inject(GlobalMessageService);
  private featureService = inject(FeatureService);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private envService = inject(EnvService);
  private http = inject(HttpClient);
  private platformId = inject<object>(PLATFORM_ID);
  private ngZone = inject(NgZone);

  currentPlan$: Observable<string | null>;
  public availablePlans = pricingFeatures;
  public billingInfo: BillingInfo | null = null;

  public subscriptionData: SubscriptionData | null = null;

  public isAnnual = true;
  public billingCycleOptions = [
    { label: 'Annual', value: true, icon: 'pi pi-calendar-plus' },
    { label: 'Monthly', value: false, icon: 'pi pi-calendar-minus' },
  ];

  public status: 'nothing' | 'success' | 'failed' = 'nothing';

  enableBilling$ = this.featureService.isFeatureEnabled('enableBilling');

  constructor() {
    this.currentPlan$ = this.billingService.getUserPlan();
  }

  ngOnInit(): void {
    // Ensure the user's current plan is fetched
    this.billingService.fetchUserPlan().catch((error) =>
      this.errorHandler.handleError({
        error,
        message: 'Failed to fetch user plan',
        showToast: true,
      }),
    );

    this.getBillingInfo();

    const shouldRefresh = this.route.snapshot.queryParamMap.get('refresh');

    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    const success = this.route.snapshot.queryParamMap.get('success');
    const cancelled = this.route.snapshot.queryParamMap.get('canceled');

    if (success && sessionId) {
      this.status = 'success';
    } else if (cancelled) {
      this.status = 'failed';
    }

    if (shouldRefresh) {
      setTimeout(() => {
        this.billingService.getBillingData().subscribe((data) => {
          this.billingInfo = data;
        });
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { refresh: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }, 500);
    }

    this.billingService.getBillingData().subscribe((data) => {
      this.billingInfo = data;
    });
  }

  getStripePlanId(planId: string): string {
    const planMap: Record<string, { annual: string; monthly: string }> = {
      free: { annual: '', monthly: '' },
      hobby: { annual: 'dl_hobby_annual', monthly: 'dl_hobby_monthly' },
      pro: { annual: 'dl_pro_annual', monthly: 'dl_pro_monthly' },
    };

    const billingCycle = this.isAnnual ? 'annual' : 'monthly';
    const plan = planMap[planId];
    return plan ? plan[billingCycle] : '';
  }

  async handleUpgrade(planId: string): Promise<void> {
    const stripePlanId = this.getStripePlanId(planId);
    if (!stripePlanId) {
      this.errorHandler.handleError({ message: 'Invalid plan ID', showToast: true });
      return;
    }
    try {
      const stripeSessionUrl =
        await this.billingService.createCheckoutSession(stripePlanId);
      window.location.href = stripeSessionUrl;
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to create Stripe session',
        showToast: true,
      });
    }
  }

  getPrice(plan: { priceAnnual?: string; priceMonth?: string }) {
    return this.isAnnual ? plan.priceAnnual : plan.priceMonth;
  }

  cancelSubscription() {
    this.confirmationService.confirm({
      message:
        'You can cancel your subscription at any time, but ' +
        "you'll lose access to all premium features, " +
        'including stats, monitor, alerts, change history, data connectors and more.' +
        'You may also loose access to your data if you have more than the free plan quota, ' +
        "so it's recommended you check this is okay, or export your data first.",
      header: 'Are you sure that you want to downgrade?',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'No, stay subscribed',
      rejectButtonStyleClass: 'p-button-sm p-button-success',
      acceptIcon: 'pi pi-times-circle mr-2',
      rejectIcon: 'pi pi-check-circle mr-2',
      acceptButtonStyleClass: 'p-button-sm p-button-danger p-button-text',
      closeOnEscape: true,
      accept: async () => {
        this.billingService
          .cancelSubscription()
          .then(() => {
            this.messagingService.showSuccess(
              'Subscription Canceled',
              'Your subscription has been successfully canceled.',
            );
            setTimeout(() => {
              window.location.reload();
            }, 500);
          })
          .catch((error) => {
            this.errorHandler.handleError({
              error,
              message: 'Failed to cancel subscription',
              showToast: true,
            });
          });
      },
    });
  }

  async getBillingInfo(): Promise<void> {
    // 1) Guard SSR
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // 2) Resolve endpoint
    const endpoint = this.envService.getEnvVar('DL_STRIPE_INFO_URL');
    if (!endpoint) {
      this.errorHandler.handleError({
        message: 'Stripe info endpoint is not configured.',
        location: 'Upgrade Page',
        showToast: true,
      });
      return;
    }

    // 3) Grab user ID (interceptor will handle the token)
    const user = await this.supabaseService.getCurrentUser();
    const userId = user?.id;
    if (!userId) {
      this.errorHandler.handleError({
        message: 'Not authenticated',
        location: 'Upgrade Page',
        showToast: true,
      });
      return;
    }

    // 4) Fire off the HTTP POST via HttpClient
    this.http.post<SubscriptionData>(endpoint, { userId }).subscribe({
      next: (data) => {
        // run inside zone to trigger change detection
        this.ngZone.run(() => {
          this.subscriptionData = data;
        });
      },
      error: (err) => {
        this.errorHandler.handleError({
          error: err,
          message: 'Failed to fetch Stripe details',
          location: 'Upgrade Page',
          showToast: true,
        });
      },
    });
  }
}

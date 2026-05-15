import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable } from 'rxjs';
import {
  BillingService,
  type BillingPlans,
  type SpecialPlans,
} from '~/app/services/billing.service';
import { EnvService, type EnvironmentType } from '~/app/services/environment.service';
import { features, type FeatureDefinitions } from '~/app/constants/feature-options';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({
  providedIn: 'root',
})
export class FeatureService {
  private billingService = inject(BillingService);
  private environmentService = inject(EnvService);
  private errorHandler = inject(ErrorHandlerService);

  private environment: EnvironmentType;
  private userPlan$: Observable<string | null>;
  private features: FeatureDefinitions = features;

  private activeFeatures$ = new BehaviorSubject<
    Record<keyof FeatureDefinitions, boolean | number>
  >({} as Record<keyof FeatureDefinitions, boolean | number>);

  constructor() {
    this.environment = this.environmentService.getEnvironmentType();
    this.userPlan$ = this.billingService.getUserPlan();

    // Reactive update for feature configurations
    combineLatest([this.userPlan$]).subscribe(([userPlan]) => {
      const userBillingPlan = this.mapSpecialPlansToBillingPlans(
        (userPlan as BillingPlans | SpecialPlans) || 'free',
      );
      const features = this.resolveFeatures(userBillingPlan || 'free');
      this.activeFeatures$.next(features);
    });
  }

  private mapSpecialPlansToBillingPlans(
    currentPlan: BillingPlans | SpecialPlans,
  ): BillingPlans {
    switch (currentPlan) {
      case 'sponsor':
      case 'complimentary':
        return 'hobby';
      case 'tester':
        return 'pro';
      case 'demo':
        return 'pro';
      case 'super':
        return 'enterprise';
      default:
        return currentPlan as BillingPlans;
    }
  }

  /**
   * Resolves features based on user plan, environment, and feature configuration.
   */
  private resolveFeatures(
    userPlan: string,
  ): Record<keyof FeatureDefinitions, boolean | number> {
    const features = {} as Record<keyof FeatureDefinitions, boolean | number>;
    interface AnyConfig {
      default: boolean | number;
      managed?: boolean | number | Record<string, boolean | number>;
      selfHosted?: boolean | number;
      dev?: boolean | number;
      demo?: boolean | number;
    }
    for (const [feature, rawConfig] of Object.entries(this.features) as [
      keyof FeatureDefinitions,
      AnyConfig,
    ][]) {
      const config = rawConfig;
      if (this.environment === 'managed') {
        // If `managed` is a single value, use it directly
        if (typeof config.managed === 'boolean' || typeof config.managed === 'number') {
          features[feature] = config.managed;
        } else if (typeof config.managed === 'object') {
          // Otherwise, check for userPlan-specific value
          features[feature] =
            (config.managed as Record<string, boolean | number>)[userPlan] ??
            config.default;
        } else {
          features[feature] = config.default;
        }
      } else if (config[this.environment] !== undefined) {
        // If there's an environment-specific value (e.g., selfHosted, demo)
        features[feature] = config[this.environment] as boolean | number;
      } else {
        // Default value
        features[feature] = config.default;
      }
    }

    return features;
  }

  /**
   * Get the resolved value for a specific feature.
   */
  public getFeatureValue<T>(feature: keyof FeatureDefinitions): Observable<T | null> {
    return this.activeFeatures$.pipe(
      map((features) => (features[feature] ?? null) as T | null),
    );
  }

  /**
   * Check if a specific feature is enabled (boolean features).
   */
  public isFeatureEnabled(feature: keyof FeatureDefinitions): Observable<boolean> {
    return this.getFeatureValue<boolean>(feature).pipe(
      map((value) => {
        if (typeof value !== 'boolean') {
          this.errorHandler.handleError({
            message: `Feature "${feature}" did not resolve to a boolean. Got: ${value}`,
            showToast: false,
          });
          return false; // Fallback to false if value isn't boolean
        }
        return value;
      }),
    );
  }

  /**
   * Check if a specific feature is enabled (boolean features) and return as a promise.
   */
  public isFeatureEnabledPromise(feature: keyof FeatureDefinitions): Promise<boolean> {
    return firstValueFrom(this.isFeatureEnabled(feature));
  }

  public async featureReportForDebug(): Promise<{ feature: string; enabled: boolean }[]> {
    const features = this.activeFeatures$.getValue();
    const featurePromises = Object.keys(features).map(async (feature) => ({
      feature,
      enabled: Boolean(
        await firstValueFrom(this.getFeatureValue(feature as keyof FeatureDefinitions)),
      ),
    }));
    return await Promise.all(featurePromises);
  }
}

import { Component, Input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import {
  type FeatureDefinitions,
  featureDescriptions,
} from '~/app/constants/feature-options';
import { EnvironmentType, EnvService } from '~/app/services/environment.service';
import { Observable } from 'rxjs';
import { BillingService } from '~/app/services/billing.service';

@Component({
  selector: 'app-feature-not-enabled',
  standalone: true,
  imports: [CommonModule, PrimeNgModule],
  template: `
    <p-messages severity="warn">
      <ng-template pTemplate>
        <div class="flex justify-between items-center w-full">
          @if (overrideText) {
            <span>
              <i class="pi pi-lock"></i>
              {{ overrideText }}
            </span>
          } @else {
            <span>
              <i class="pi pi-lock"></i>
              {{ featureName || 'This feature' }} is not available
              @if (environment === 'managed') {
                on the {{ (userPlan$ | async) || 'current' }} plan
              } @else {
                in {{ mapEnvironmentToString(environment) }} environments
              }
            </span>
          }
          @if (environment === 'managed') {
            <p-button
              severity="warning"
              label="Upgrade"
              icon="pi pi-arrow-circle-right"
              size="small"
              routerLink="/settings/upgrade"
            />
          }
        </div>
      </ng-template>
    </p-messages>
  `,
  styles: [],
})
export class FeatureNotEnabledComponent implements OnInit {
  private billingService = inject(BillingService);
  private environmentService = inject(EnvService);

  @Input() feature!: keyof FeatureDefinitions;
  @Input() featureName?: string;
  featureDescription?: string;

  @Input() overrideText?: string;

  environment: EnvironmentType;
  userPlan$: Observable<string | null>;

  constructor() {
    this.environment = this.environmentService.getEnvironmentType();
    this.userPlan$ = this.billingService.getUserPlan();
  }

  ngOnInit(): void {
    this.billingService.fetchUserPlan();
    this.featureName = this.featureName || featureDescriptions[this.feature]?.label;
    this.featureDescription = featureDescriptions[this.feature]?.description;
  }

  mapEnvironmentToString(env: EnvironmentType): string {
    switch (env) {
      case 'dev':
        return 'development';
      case 'selfHosted':
        return 'self-hosted';
      case 'demo':
        return 'live demo';
      default:
        return env;
    }
  }
}

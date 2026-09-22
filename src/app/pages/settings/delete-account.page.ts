import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PrimeNgModule } from '~/app/prime-ng.module';

import { DeleteAccountComponent } from '~/app/components/settings/delete-data/delete-data.component';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';
import { FeatureService } from '~/app/services/features.service';

@Component({
  standalone: true,
  selector: 'app-settings-delete-account-page',
  imports: [
    CommonModule,
    PrimeNgModule,
    DeleteAccountComponent,
    FeatureNotEnabledComponent,
  ],
  template: `
    @if (userAccounts$ | async) {
      <app-delete-account />
    } @else {
      <app-feature-not-enabled feature="userAccounts" />
    }
  `,
})
export default class DeleteAccountPage {
  private featureService = inject(FeatureService);
  userAccounts$ = this.featureService.isFeatureEnabled('userAccounts');
}

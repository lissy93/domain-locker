import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';

import { DeleteAccountComponent } from '~/app/components/settings/delete-data/delete-data.component';

@Component({
  standalone: true,
  selector: 'app-settings-delete-account-page',
  imports: [PrimeNgModule, DeleteAccountComponent],
  template: '<app-delete-account />',
})
export default class DeleteAccountPage {}

import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { NotificationsListComponent } from '~/app/components/notifications-list/notifications-list.component';

@Component({
  standalone: true,
  selector: 'app-notifications-page',
  templateUrl: './index.page.html',
  imports: [PrimeNgModule, NotificationsListComponent],
})
export default class NotificationsPage {}

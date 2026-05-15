import { Component, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-domains-search-page',
  imports: [PrimeNgModule],
  template: ``,
})
export default class SearchPageComponent {
  private databaseService = inject(DatabaseService);
  private errorHandlerService = inject(ErrorHandlerService);

  loading = true;
}

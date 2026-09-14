import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { DomainCollectionComponent } from '~/app/components/domain-things/domain-collection/domain-collection.component';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { DbDomain } from '~/app/../types/Database';

@Component({
  standalone: true,
  selector: 'app-domains-search-page',
  imports: [PrimeNgModule, DomainCollectionComponent],
  template: `
    <h1 class="text-2xl my-3">Search Domains</h1>
    @if (!loading) {
      <app-domain-view
        [domains]="domains"
        [initialSearch]="query"
        [showAddButton]="false"
        preFilteredText="matching your search"
      />
    }
  `,
})
export default class SearchPageComponent implements OnInit, OnDestroy {
  private databaseService = inject(DatabaseService);
  private errorHandlerService = inject(ErrorHandlerService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  domains: DbDomain[] = [];
  query = '';
  loading = true;
  private subscriptions = new Subscription();

  ngOnInit() {
    this.query = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.subscriptions.add(
      this.databaseService.domains$.subscribe({
        next: (domains) => {
          this.domains = domains;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorHandlerService.handleError({
            error,
            message: "Couldn't fetch domains from database",
            showToast: true,
            location: 'SearchPageComponent',
          });
          this.loading = false;
          this.cdr.markForCheck();
        },
      }),
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}

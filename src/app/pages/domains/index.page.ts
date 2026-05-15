import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';

import { PrimeNgModule } from '../../prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { DbDomain } from '~/app/../types/Database';
import { DomainCollectionComponent } from '~/app/components/domain-things/domain-collection/domain-collection.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-domains-page',
  imports: [DomainCollectionComponent, PrimeNgModule],
  template: `
    @if (!loading) {
      <app-domain-view
        [loading]="loading"
        [domains]="domains"
        ($triggerReload)="newDomainAdded()"
      />
    }
  `,
})
export default class DomainAllPageComponent implements OnInit, OnDestroy {
  private databaseService = inject(DatabaseService);
  private errorHandlerService = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  domains: DbDomain[] = [];
  loading = true;
  private subscriptions: Subscription = new Subscription();

  ngOnInit() {
    this.loadDomains();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  newDomainAdded() {
    this.loadDomains();
  }

  loadDomains() {
    this.loading = true;

    this.subscriptions.add(
      this.databaseService.instance.listDomains().subscribe({
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
            location: 'DomainAllPageComponent.loadDomains',
          });
          this.loading = false;
          this.cdr.markForCheck();
        },
      }),
    );
  }
}

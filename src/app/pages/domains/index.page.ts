import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PrimeNgModule } from '../../prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { DbDomain } from '~/app/../types/Database';
import { DomainCollectionComponent } from '~/app/components/domain-things/domain-collection/domain-collection.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-domains-page',
  imports: [DomainCollectionComponent, PrimeNgModule, RouterLink, TranslateModule],
  template: `
    @if (!loading) {
      <app-domain-view
        [loading]="loading"
        [domains]="domains"
        ($triggerReload)="newDomainAdded()"
        (archivedChange)="onArchivedChange($event)"
      />
      @if (archivedCount) {
        <a
          routerLink="/domains/archived"
          class="inline-flex items-center gap-2 mt-2 text-primary opacity-70 underline"
        >
          <i class="pi pi-archive"></i>
          {{ 'DOMAINS.ARCHIVED.VIEW_LINK' | translate: { count: archivedCount } }}
        </a>
      }
    }
  `,
})
export default class DomainAllPageComponent implements OnInit, OnDestroy {
  private databaseService = inject(DatabaseService);
  private errorHandlerService = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  domains: DbDomain[] = [];
  archivedCount = 0;
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

  /** Takes a domain archived from its card off this list */
  onArchivedChange(domain: DbDomain) {
    this.domains = this.domains.filter((item) => item.id !== domain.id);
    this.archivedCount++;
  }

  loadDomains() {
    this.loading = true;

    this.subscriptions.add(
      this.databaseService.domainGroups$.subscribe({
        next: ({ active, archived }) => {
          this.domains = active;
          this.archivedCount = archived.length;
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

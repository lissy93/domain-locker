import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import DatabaseService from '~/app/services/database.service';
import { DbDomain } from '~/app/../types/Database';
import { DomainCollectionComponent } from '~/app/components/domain-things/domain-collection/domain-collection.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-archived-domains-page',
  imports: [DomainCollectionComponent, RouterLink, TranslateModule],
  template: `
    <h2 class="mt-0 mb-2">{{ 'DOMAINS.ARCHIVED.TITLE' | translate }}</h2>
    <p class="mt-0 mb-4 text-surface-400">
      {{ 'DOMAINS.ARCHIVED.DESCRIPTION' | translate }}
    </p>
    @if (!loading) {
      @if (domains.length) {
        <app-domain-view
          [domains]="domains"
          [showAddButton]="false"
          (archivedChange)="onArchivedChange($event)"
        />
      } @else {
        <div class="p-card p-4">
          <h4 class="mt-0 mb-4">{{ 'DOMAINS.ARCHIVED.EMPTY_TITLE' | translate }}</h4>
          <p>
            {{ 'DOMAINS.ARCHIVED.EMPTY_TEXT' | translate }}
            <a routerLink="/domains" class="text-primary underline">{{
              'DOMAINS.ARCHIVED.BACK_TO_DOMAINS' | translate
            }}</a>
          </p>
        </div>
      }
    }
  `,
})
export default class ArchivedDomainsPageComponent implements OnInit, OnDestroy {
  private databaseService = inject(DatabaseService);
  private errorHandlerService = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  domains: DbDomain[] = [];
  loading = true;
  private subscription?: Subscription;

  ngOnInit() {
    this.subscription = this.databaseService.archivedDomains$.subscribe({
      next: (domains) => {
        this.domains = domains;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorHandlerService.handleError({
          error,
          message: "Couldn't fetch archived domains from database",
          showToast: true,
          location: 'ArchivedDomainsPageComponent.ngOnInit',
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  /** Takes a domain unarchived from its card off this list */
  onArchivedChange(domain: DbDomain) {
    this.domains = this.domains.filter((item) => item.id !== domain.id);
  }
}

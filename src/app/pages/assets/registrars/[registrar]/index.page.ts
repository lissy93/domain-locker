import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DbDomain } from '~/app/../types/Database';
import DatabaseService from '~/app/services/database.service';
import { DomainCollectionComponent } from '~/app/components/domain-things/domain-collection/domain-collection.component';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-assets-registrars-registrar-page',
  imports: [PrimeNgModule, DomainCollectionComponent, DomainFaviconComponent],
  template: `
    <h1 class="flex gap-3 align-items-center">
      @if (registrarUrl) {
        <app-domain-favicon
          [domain]="registrarUrl"
          [size]="28"
          class=""
        ></app-domain-favicon>
      }
      {{ registrarName }}
    </h1>
    @if (registrarUrl && registrarUrl !== 'Unknown') {
      <p class="md:float-right">
        <a [href]="registrarUrl"
          ><i class="pi pi-external-link mr-2 capitalize"></i>
          {{ registrarName }} Website</a
        >
      </p>
    }
    @if (!loading) {
      <app-domain-view
        [domains]="domains"
        [preFilteredText]="'registered with ' + registrarName + ''"
        [showAddButton]="false"
      />
    }
    @if (loading) {
      <p-progressSpinner />
    }
  `,
})
export default class RegistrarDomainsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  registrarName = '';
  registrarUrl = '';
  domains: DbDomain[] = [];
  loading = true;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.registrarName = decodeURIComponent(params['registrar']);
      this.loadDomains();
    });
  }

  loadDomains() {
    this.loading = true;
    this.databaseService.instance.registrarQueries
      .getDomainsByRegistrar(this.registrarName)
      .subscribe({
        next: (domains) => {
          this.domains = domains;
          this.loading = false;
          if (domains.length > 0 && domains[0]?.registrar?.url) {
            this.registrarUrl = domains[0].registrar.url;
            if (this.registrarUrl === 'Unknown') {
              this.registrarUrl = '';
            } else if (!this.registrarUrl.startsWith('http')) {
              this.registrarUrl = 'https://' + this.registrarUrl;
            }
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorHandler.handleError({
            message: 'Failed to load domains for this registrar',
            error,
            showToast: true,
            location: 'RegistrarIndexPage.loadDomains',
          });
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }
}

import { Component, OnInit, inject } from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DbDomain } from '~/app/../types/Database';
import DatabaseService from '~/app/services/database.service';
import { MessageService } from 'primeng/api';
import { DomainCollectionComponent } from '~/app/components/domain-things/domain-collection/domain-collection.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-assets-certs-issuer-page',
  imports: [PrimeNgModule, DomainCollectionComponent],
  template: `
    <h1>Domains using SSL certificates from "{{ issuer }}"</h1>
    @if (!loading && domains.length > 0) {
      <app-domain-view
        [domains]="domains"
        [preFilteredText]="'with certificates from ' + issuer + ''"
        [showAddButton]="false"
        [loading]="loading"
      />
    }
    @if (!loading && domains.length === 0) {
      <p-message severity="info" text="No domains found for this SSL issuer."></p-message>
    }
    @if (loading) {
      <p-progressSpinner></p-progressSpinner>
    }
  `,
})
export default class SslIssuerDomainsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  issuer = '';
  domains: DbDomain[] = [];
  loading = true;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.issuer = decodeURIComponent(params['issuer']);
      this.loadDomains();
    });
  }

  loadDomains() {
    this.loading = true;
    this.databaseService.instance.sslQueries
      .getDomainsBySslIssuer(this.issuer)
      .subscribe({
        next: (domains) => {
          this.domains = domains;
          this.loading = false;
          if (domains.length === 0) {
            this.messageService.add({
              severity: 'info',
              summary: 'No Domains',
              detail: `No domains found using SSL certificates from "${this.issuer}"`,
            });
          }
        },
        error: (error) => {
          this.errorHandler.handleError({
            error,
            message: 'Failed to load domains for this SSL issuer',
            showToast: true,
            location: 'SslIssuerDomainsPageComponent',
          });
          this.loading = false;
        },
      });
  }
}

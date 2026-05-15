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
  selector: 'app-assets-hosts-host-page',
  imports: [PrimeNgModule, DomainCollectionComponent],
  template: `
    <h1>Domains hosted by "{{ hostIsp }}"</h1>
    @if (!loading) {
      <app-domain-view
        [domains]="domains"
        [preFilteredText]="'hosted with ' + hostIsp + ''"
        [showAddButton]="false"
        [loading]="loading"
      />
    }
    @if (loading) {
      <p-progressSpinner></p-progressSpinner>
    }
  `,
})
export default class HostDomainsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  hostIsp = '';
  domains: DbDomain[] = [];
  loading = true;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.hostIsp = params['host'];
      this.loadDomains();
    });
  }

  loadDomains() {
    this.loading = true;
    this.databaseService.instance.hostsQueries.getDomainsByHost(this.hostIsp).subscribe({
      next: (domains) => {
        this.domains = domains;
        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to load domains for this host',
          error,
          showToast: true,
          location: 'HostDomainsPageComponent.loadDomains',
        });
        this.loading = false;
      },
    });
  }
}

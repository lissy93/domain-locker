import { Component, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { SubdomainListComponent } from './subdomain-list.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { groupSubdomains } from './subdomain-utils';
import { LazyLoadDirective } from '~/app/utils/lazy.directive';

interface SubdomainEntry {
  id?: string;
  name: string;
  sd_info?: string | null;
  domain_name?: string;
}

interface DomainGroup {
  name: string;
  subdomains: SubdomainEntry[];
  loadingSubs: boolean;
}

@Component({
  standalone: true,
  selector: 'app-assets-subdomains-page',
  imports: [
    RouterModule,
    PrimeNgModule,
    SubdomainListComponent,
    DomainFaviconComponent,
    LazyLoadDirective,
  ],
  templateUrl: './subdomains.page.html',
})
export default class SubdomainsIndexPageComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);

  subdomains: { domain: string; subdomains: SubdomainEntry[] }[] = [];
  loading = true;
  domains: DomainGroup[] = [];

  ngOnInit() {
    this.loadParentDomains();
  }

  loadParentDomains() {
    this.loading = true;
    this.databaseService.instance.listDomainNames().subscribe({
      next: (domains) => {
        this.domains = domains.map((domainName) => ({
          name: domainName,
          subdomains: [],
          loadingSubs: false,
        }));
        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to list parent domains',
          error,
        });
        this.loading = false;
      },
    });
  }

  loadSubdomainsForDomain(domain: DomainGroup) {
    if (domain.subdomains?.length || domain.loadingSubs) {
      return;
    }

    domain.loadingSubs = true;
    this.databaseService.instance.subdomainsQueries
      .getSubdomainsByDomain(domain.name)
      .subscribe({
        next: (subs) => {
          domain.subdomains = subs;
          domain.loadingSubs = false;
        },
        error: (error) => {
          this.errorHandler.handleError({
            error,
            message: `Unable to load subdomains for ${domain.name}`,
            showToast: true,
          });
          domain.loadingSubs = false;
        },
      });
  }

  loadSubdomains() {
    this.loading = true;
    this.databaseService.instance.subdomainsQueries.getAllSubdomains().subscribe({
      next: (subdomains) => {
        this.subdomains = groupSubdomains(subdomains);
        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({ error });
        this.loading = false;
      },
    });
  }
}

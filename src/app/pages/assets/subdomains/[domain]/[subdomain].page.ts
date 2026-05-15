import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import DatabaseService from '~/app/services/database.service';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { makeKVList } from './../subdomain-utils';
import { ConfirmationService } from 'primeng/api';
import { DomainInfoComponent } from '~/app/components/domain-things/domain-info/domain-info.component';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs';
import { DbDomain } from '~/app/../types/Database';
import { NotFoundComponent } from '~/app/components/misc/domain-not-found.component';
import { FeatureService } from '~/app/services/features.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { EnvService } from '~/app/services/environment.service';

@Component({
  standalone: true,
  selector: 'app-assets-subdomains-domain-subdomain-page',
  imports: [PrimeNgModule, DomainInfoComponent, NotFoundComponent],
  templateUrl: './[subdomain].page.html',
})
export default class SubdomainDetailPageComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(GlobalMessageService);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private confirmationService = inject(ConfirmationService);
  private featureService = inject(FeatureService);
  private envService = inject(EnvService);

  domain = '';
  subdomainName = '';
  subdomainInfo: { key: string; value: string }[] = [];
  subdomain: { name?: string; sd_info?: unknown } | null = null;
  loading = true;
  subdomainWebsiteInfo: DbDomain | null = null;

  ngOnInit() {
    // Get parent domain and subdomain name from URL params
    this.domain = this.route.snapshot.params['domain'];
    this.subdomainName = this.route.snapshot.params['subdomain'];
    // Load subdomain info from db
    this.loadSubdomain();
    // Fetch live data about the website
    this.loadDomainInfo();
  }

  loadSubdomain() {
    this.loading = true;
    this.databaseService.instance.subdomainsQueries
      .getSubdomainInfo(this.domain, this.subdomainName)
      .subscribe({
        next: (subdomain) => {
          this.subdomain = subdomain;
          this.subdomainInfo = subdomain ? makeKVList(subdomain.sd_info) : [];
          this.loading = false;
        },
        error: (error) => {
          this.errorHandler.handleError({ error });
          this.loading = false;
        },
      });
  }

  private async loadDomainInfo(): Promise<void> {
    const domainName = this.subdomainName + '.' + this.domain;
    const domainInfoEndpoint = this.envService.getEnvVar(
      'DL_DOMAIN_INFO_API',
      '/api/domain-info',
    );
    this.http
      .get<{ domainInfo: DbDomain }>(`${domainInfoEndpoint}?domain=${domainName}`)
      .pipe(
        catchError((error) => {
          throw error;
        }),
      )
      .subscribe({
        next: async (fetchedDomainInfo) => {
          const results = { ...fetchedDomainInfo.domainInfo };
          this.subdomainWebsiteInfo = results;
        },
        error: (error) => {
          this.errorHandler.handleError({
            error,
            message: 'Failed to determine additional subdomain info',
            showToast: true,
          });
        },
      });
  }

  async confirmDelete() {
    if (!(await this.featureService.isFeatureEnabledPromise('writePermissions'))) {
      this.messageService.showWarn(
        'Write Permissions Disabled',
        "It's not possible to add subdomains on the demo instance.",
      );
      return;
    }
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the subdomain "${this.subdomainName}.${this.domain}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.databaseService.instance.subdomainsQueries
          .deleteSubdomain(this.domain, this.subdomainName)
          .subscribe({
            next: () => {
              this.messageService.showSuccess(
                'Deleted',
                `Subdomain "${this.subdomainName}.${this.domain}" has been deleted successfully.`,
              );
              this.router.navigate(['/assets/subdomains', this.domain]);
            },
            error: (error: Error) => {
              this.errorHandler.handleError({
                error,
                showToast: true,
                message: 'Failed to delete the subdomain. Please try again.',
              });
            },
          });
      },
      reject: () => {
        this.messageService.showInfo('Cancelled', 'Deletion cancelled');
      },
    });
  }
}

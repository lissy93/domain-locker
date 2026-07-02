import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeNgModule } from '../../../prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { type DbDomain } from '~/app/../types/Database';
import { DomainUtils } from '~/app/services/domain-utils.service';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { ConfirmationService, MessageService } from 'primeng/api';
import { catchError, switchMap, tap, of } from 'rxjs';
import { DlIconComponent } from '~/app/components/misc/svg-icon.component';
import { LoadingComponent } from '~/app/components/misc/loading.component';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { DomainUpdatesComponent } from '~/app/components/domain-things/domain-updates/domain-updates.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { DomainSparklineComponent } from '~/app/components/monitor/sparklines/sparklines.component';
import { UptimeHistoryComponent } from '~/app/components/monitor/uptime-history/uptime-history.component';
import { FeatureService } from '~/app/services/features.service';
import { LazyLoadDirective } from '~/app/utils/lazy.directive';
import { AdditionalResourcesComponent } from '~/app/components/misc/external-links.component';
import { DomainInfoComponent } from '~/app/components/domain-things/domain-info/domain-info.component';
import { NotFoundComponent } from '~/app/components/misc/domain-not-found.component';
import { SubdomainListComponent } from '~/app/pages/assets/subdomains/subdomain-list.component';

@Component({
  standalone: true,
  selector: 'app-domains-domain-name-page',
  imports: [
    CommonModule,
    PrimeNgModule,
    DomainFaviconComponent,
    DlIconComponent,
    LoadingComponent,
    DomainUpdatesComponent,
    DomainSparklineComponent,
    UptimeHistoryComponent,
    LazyLoadDirective,
    AdditionalResourcesComponent,
    DomainInfoComponent,
    NotFoundComponent,
    SubdomainListComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './domain-name.page.html',
  styleUrl: './domain-name.page.scss',
})
export default class DomainDetailsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  domainUtils = inject(DomainUtils);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private globalMessageService = inject(GlobalMessageService);
  private errorHandler = inject(ErrorHandlerService);
  private featureService = inject(FeatureService);
  private cdr = inject(ChangeDetectorRef);

  domain: DbDomain | null = null;
  name: string | null = null;
  domainNotFound = false;
  monitorEnabled$ = this.featureService.isFeatureEnabled('domainMonitor');

  shouldMountMonitor = false;
  shouldMountHistory = false;

  // Monitor charts only become meaningful after a couple of days of history
  private readonly minMonitorHistoryDays = 2;

  ngOnInit() {
    this.route.params
      .pipe(
        switchMap((params) => {
          this.name = params['domain-name'];
          return this.databaseService.instance.getDomain(this.name!).pipe(
            catchError((err) => {
              this.domainNotFound = true;
              this.errorHandler.handleError({
                error: err,
                message: 'Failed to load domain details',
                showToast: true,
                location: 'Domain',
              });
              this.cdr.markForCheck();
              return of(null);
            }),
          );
        }),
        tap((domain) => {
          this.domain = domain;
          this.cdr.markForCheck();
          // if ?update=true, re-fetch in 1s and then remove param
          if (this.route.snapshot.queryParamMap.get('update') === 'true' && this.name) {
            setTimeout(() => {
              this.databaseService.instance.getDomain(this.name!).subscribe(
                (refreshed) => {
                  this.domain = refreshed;
                  this.cdr.markForCheck();
                },
                () => {
                  /* no-op */
                },
              );
              this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { update: null },
                queryParamsHandling: 'merge',
                replaceUrl: true,
              });
            }, 1000);
          }
        }),
      )
      .subscribe();
  }

  onMonitorVisible(): void {
    this.shouldMountMonitor = true;
  }

  onHistoryVisible(): void {
    this.shouldMountHistory = true;
  }

  /* True once the domain has been tracked long enough for monitor charts */
  get hasMonitorHistory(): boolean {
    if (!this.domain?.created_at) return false;
    const addedAt = new Date(this.domain.created_at).getTime();
    const daysTracked = (Date.now() - addedAt) / (1000 * 60 * 60 * 24);
    return daysTracked >= this.minMonitorHistoryDays;
  }

  public filterIpAddresses(
    ipAddresses: { ip_address: string; is_ipv6: boolean }[] | undefined,
    isIpv6: boolean,
  ): { ip_address: string; is_ipv6: boolean }[] {
    if (!ipAddresses) return [];
    return ipAddresses.filter((ip) => ip.is_ipv6 === isIpv6);
  }

  confirmDelete(event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Are you sure you want to delete this domain?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteDomain(),
    });
  }

  deleteDomain() {
    if (!this.domain) return;
    this.databaseService.instance.deleteDomain(this.domain.id).subscribe({
      next: () => {
        this.globalMessageService.showMessage({
          severity: 'success',
          summary: 'Success',
          detail: 'Domain deleted successfully',
        });
        this.router.navigate(['/domains']);
      },
      error: (err) => {
        this.errorHandler.handleError({
          error: err,
          message: 'Failed to delete domain',
          showToast: true,
          location: 'Domain',
        });
      },
    });
  }
}

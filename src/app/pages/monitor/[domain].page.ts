import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { type DbDomain } from '~/app/../types/Database';
import { DomainUtils } from '~/app/services/domain-utils.service';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { ConfirmationService, MessageService } from 'primeng/api';
import { catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { LoadingComponent } from '~/app/components/misc/loading.component';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { DomainSparklineComponent } from '~/app/components/monitor/sparklines/sparklines.component';
import { UptimeHistoryComponent } from '~/app/components/monitor/uptime-history/uptime-history.component';
import { FeatureService } from '~/app/services/features.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';
import { LazyLoadDirective } from '~/app/utils/lazy.directive';
import { NotFoundComponent } from '~/app/components/misc/domain-not-found.component';

@Component({
  standalone: true,
  selector: 'app-monitor-domain-page',
  imports: [
    CommonModule,
    PrimeNgModule,
    DomainFaviconComponent,
    LoadingComponent,
    DomainSparklineComponent,
    UptimeHistoryComponent,
    FeatureNotEnabledComponent,
    LazyLoadDirective,
    NotFoundComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './[domain].page.html',
})
export default class DomainDetailsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  domainUtils = inject(DomainUtils);
  private featureService = inject(FeatureService);
  private router = inject(Router);
  private globalMessageService = inject(GlobalMessageService);
  private errorHandler = inject(ErrorHandlerService);

  domain: DbDomain | null = null;
  domainId: string | null = null;
  name: string | null = null;
  domainNotFound = false;
  monitorEnabled$ = this.featureService.isFeatureEnabled('domainMonitor');

  shouldMountCalendar = false;

  ngOnInit() {
    this.route.params
      .pipe(
        switchMap((params) => {
          const domainName = params['domain'];
          this.name = domainName;
          return this.databaseService.instance.getDomain(domainName).pipe(
            catchError((error) => {
              this.domainNotFound = true;
              this.errorHandler.handleError({
                error,
                message: 'Failed to load domain details',
                showToast: true,
                location: 'Domain',
              });
              return of(null);
            }),
          );
        }),
      )
      .subscribe((domain) => {
        this.domain = domain;
        if (domain) this.domainId = domain.id;
      });
  }

  onCalendarVisible(): void {
    this.shouldMountCalendar = true;
  }
}

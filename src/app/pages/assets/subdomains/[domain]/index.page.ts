import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SubdomainListComponent } from '~/app/pages/assets/subdomains/subdomain-list.component';
import DatabaseService from '~/app/services/database.service';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { NotFoundComponent } from '~/app/components/misc/domain-not-found.component';
import { HttpClient } from '@angular/common/http';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { catchError, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  autoSubdomainsReadyForSave,
  filterOutIgnoredSubdomains,
} from '../subdomain-utils';
import { AddSubdomainDialogComponent } from '../add-subdomain.component';
import { EnvService } from '~/app/services/environment.service';

@Component({
  standalone: true,
  selector: 'app-assets-subdomains-domain-page',
  imports: [
    SubdomainListComponent,
    PrimeNgModule,
    NotFoundComponent,
    AddSubdomainDialogComponent,
  ],
  templateUrl: './index.page.html',
})
export default class SubdomainsDomainPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private http = inject(HttpClient);
  private globalMessageService = inject(GlobalMessageService);
  private envService = inject(EnvService);

  domain = '';
  subdomains: { id?: string; name: string; sd_info?: unknown; domain_name?: string }[] =
    [];
  loading = true;
  validDomain = true;

  ngOnInit() {
    this.domain = this.route.snapshot.params['domain'];
    this.loadSubdomains();
  }

  afterSuccess() {
    this.globalMessageService.showMessage({
      severity: 'success',
      summary: 'Success',
      detail: 'Subdomains saved successfully!',
    });
    this.loadSubdomains();
  }

  loadSubdomains() {
    this.loading = true;
    this.databaseService.instance.subdomainsQueries
      .getSubdomainsByDomain(this.domain)
      .subscribe({
        next: (subdomains) => {
          this.subdomains = subdomains.map((sd) => ({
            ...sd,
            sd_info:
              typeof sd.sd_info === 'string' ? this.parseSdInfo(sd.sd_info) : sd.sd_info,
          }));
          this.validDomain = true;
          this.loading = false;
        },
        error: (error) => {
          this.errorHandler.handleError({ error });
          this.validDomain = false;
          this.loading = false;
        },
      });
  }
  searchForSubdomains() {
    this.loading = true;
    const domainSubsEndpoint = this.envService.getEnvVar(
      'DL_DOMAIN_SUBS_API',
      '/api/domain-subs',
    );
    this.http
      .get<{ subdomain: string }[]>(`${domainSubsEndpoint}?domain=${this.domain}`)
      .pipe(
        // 1) filter out ignored subdomains
        map((response) => filterOutIgnoredSubdomains(response, this.domain)),
        // 2) pass them to a helper that handles “found vs none,”
        //    returning either a saving Observable or `of(null)`
        switchMap((validSubs) => this.handleDiscoveredSubdomains(validSubs)),
        // 3) handle any error that happened in the pipeline
        catchError((error) => {
          this.errorHandler.handleError({ error, message: 'Failed to save subdomains.' });
          return of(null);
        }),
        // 4) stop loading no matter what
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe();
  }

  /**
   * A small helper that shows messages and returns an Observable
   * that either saves subdomains or just completes immediately.
   */
  private handleDiscoveredSubdomains(
    validSubdomains: { subdomain: string }[],
  ): Observable<unknown> {
    if (!validSubdomains.length) {
      // No subdomains → show warning & do nothing
      this.globalMessageService.showMessage({
        severity: 'warn',
        summary: 'No Valid Subdomains Found',
        detail: 'No valid subdomains were discovered for this domain.',
      });
      return of(null);
    }

    // We have subdomains → show info, proceed to save them
    this.globalMessageService.showMessage({
      severity: 'info',
      summary: 'Subdomains Found',
      detail: `${validSubdomains.length} subdomains were discovered for this domain.`,
    });

    const subdomainsReadyForSave = autoSubdomainsReadyForSave(validSubdomains);

    return this.databaseService.instance.subdomainsQueries
      .saveSubdomainsForDomainName(this.domain, subdomainsReadyForSave)
      .pipe(tap(() => this.afterSuccess()));
  }

  private parseSdInfo(sdInfo: string): unknown {
    try {
      return JSON.parse(sdInfo);
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to parse subdomain info.',
      });
      return null;
    }
  }
}

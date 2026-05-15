import { Component, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { Registrar } from '~/app/../types/common';
import DatabaseService from '~/app/services/database.service';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-assets-registrars-page',
  imports: [RouterModule, PrimeNgModule, DomainFaviconComponent],
  templateUrl: './index.page.html',
})
export default class RegistrarsIndexPageComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);

  registrars: (Registrar & { domainCount: number })[] = [];
  loading = true;

  ngOnInit() {
    this.loadRegistrars();
  }

  loadRegistrars() {
    this.loading = true;
    const queries = this.databaseService.instance.registrarQueries;
    forkJoin({
      registrars: queries.getRegistrars(),
      counts: queries.getDomainCountsByRegistrar(),
    }).subscribe({
      next: ({ registrars, counts }) => {
        this.registrars = registrars
          .map((registrar) => ({
            ...registrar,
            domainCount: counts[registrar.name] || 0,
          }))
          .sort((a, b) => b.domainCount - a.domainCount);
        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to load registrars',
          error,
          showToast: true,
          location: 'RegistrarsIndexPageComponent.loadRegistrars',
        });
        this.loading = false;
      },
    });
  }

  public makePrettyUrl(domain: string): string {
    try {
      let sanitizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
      sanitizedDomain = sanitizedDomain.split('/')[0];
      return sanitizedDomain;
    } catch {
      return domain;
    }
  }
}

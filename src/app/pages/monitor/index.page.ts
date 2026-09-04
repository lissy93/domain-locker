import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { FeatureService } from '~/app/services/features.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';
import { DbDomain } from '~/app/../types/Database';
import { NgApexchartsModule } from 'ng-apexcharts';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { Router, RouterModule } from '@angular/router';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { ApexOptions } from 'ng-apexcharts';
import {
  getUptimeColor,
  getResponseCodeColor,
  getPerformanceColor,
} from './monitor-helpers';
import { EnvService } from '~/app/services/environment.service';
import type { UptimeRow as UptimeData } from '~/types/common';

interface DomainSummary {
  domainId: string;
  domainName: string;
  sparklineData: { x: string; y: number }[];
  responseCodeSummary: { code: number; count: number }[];
  uptimePercentage: number;
  avgResponseTime: number;
  avgDnsTime: number;
  avgSslTime: number;

  responseCodeSeries: number[];
  responseCodeLabels: string[];
  responseCodeColors: string[];
}

@Component({
  selector: 'app-monitor-page',
  standalone: true,
  imports: [
    CommonModule,
    PrimeNgModule,
    FeatureNotEnabledComponent,
    NgApexchartsModule,
    RouterModule,
    DomainFaviconComponent,
  ],
  templateUrl: './index.page.html',
})
export default class MonitorPage implements OnInit {
  private router = inject(Router);
  private featureService = inject(FeatureService);
  private databaseService = inject(DatabaseService);
  private errorHandlerService = inject(ErrorHandlerService);
  private envService = inject(EnvService);
  private cdr = inject(ChangeDetectorRef);

  monitorEnabled$ = this.featureService.isFeatureEnabled('domainMonitor');

  domains: DbDomain[] = [];
  domainSummaries: DomainSummary[] = [];
  loading = false;
  isSelfHosted = false;

  getUptimeColor = getUptimeColor;
  getResponseCodeColor = getResponseCodeColor;
  getPerformanceColor = getPerformanceColor;

  sparkLineConfig: ApexOptions = {
    chart: {
      type: 'line',
      height: 50,
      sparkline: { enabled: true },
    },
  };

  donutChartConfig: ApexOptions = {
    chart: {
      type: 'donut',
      height: 50,
      width: 50,
    },
  };

  ngOnInit(): void {
    this.isSelfHosted = this.envService.getEnvironmentType() === 'selfHosted';
    this.loadDomains();
  }

  loadDomains(): void {
    this.loading = true;
    this.databaseService.domains$.subscribe({
      next: (domains) => {
        this.domains = domains;
        this.loading = false;
        this.loadDomainSummaries();
      },
      error: (error) => {
        this.errorHandlerService.handleError({
          error,
          message: "Couldn't fetch domains from database",
          showToast: true,
          location: 'domains',
        });
        this.loading = false;
      },
    });
  }

  /** One assignment once every history has landed, so a hydrated load renders */
  async loadDomainSummaries(): Promise<void> {
    if (!this.domains.length) return;
    try {
      const histories = await this.fetchHistories();
      this.domainSummaries = this.domains.map((domain) =>
        this.summarise(domain, histories[domain.id] ?? []),
      );
    } catch (error) {
      this.errorHandlerService.handleError({
        error,
        message: 'Failed to load uptime history',
        location: 'Monitor',
      });
    }
    this.cdr.markForCheck();
  }

  /** Supabase has no batch endpoint, so it falls back to one call per domain */
  private fetchHistories(): Promise<Record<string, UptimeData[]>> {
    const service = this.databaseService.instance;
    const ids = this.domains.map((domain) => domain.id);
    if (service.getDomainUptimeBatch) {
      return service.getDomainUptimeBatch(ids, 'day');
    }
    return Promise.all(
      this.domains.map((domain) =>
        service
          .getDomainUptime(domain.user_id, domain.id, 'day')
          .then((rows) => [domain.id, rows] as const),
      ),
    ).then((entries) => Object.fromEntries(entries));
  }

  private summarise(domain: DbDomain, uptimeData: UptimeData[]): DomainSummary {
    const responseCodeSummary = this.getResponseCodeSummary(uptimeData);
    const average = (pick: (entry: UptimeData) => number | null) =>
      uptimeData.length
        ? uptimeData.reduce((sum, entry) => sum + Number(pick(entry) || 0), 0) /
          uptimeData.length
        : 0;

    return {
      domainId: domain.id,
      domainName: domain.domain_name,
      sparklineData: uptimeData.map((entry) => ({
        x: entry.checked_at,
        y: entry.response_time_ms || 0,
      })),
      responseCodeSummary,
      responseCodeSeries: responseCodeSummary.map((item) => item.count),
      responseCodeLabels: responseCodeSummary.map((item) => `${item.code}`),
      responseCodeColors: responseCodeSummary.map((item) =>
        this.getResponseCodeColor(item.code),
      ),
      uptimePercentage: uptimeData.length
        ? (uptimeData.filter((entry) => entry.is_up).length / uptimeData.length) * 100
        : 0,
      avgResponseTime: average((entry) => entry.response_time_ms),
      avgDnsTime: average((entry) => entry.dns_lookup_time_ms),
      avgSslTime: average((entry) => entry.ssl_handshake_time_ms),
    };
  }

  visitDomain(domainName: string): void {
    this.router.navigate(['/monitor/', domainName]);
  }

  getResponseCodeSummary(uptimeData: UptimeData[]): { code: number; count: number }[] {
    const responseCodeMap: Record<number, number> = {};
    uptimeData.forEach((entry) => {
      const code = entry.response_code || 0;
      responseCodeMap[code] = (responseCodeMap[code] || 0) + 1;
    });

    return Object.entries(responseCodeMap).map(([code, count]) => ({
      code: parseInt(code, 10),
      count,
    }));
  }

  public isNaN(value: unknown): boolean {
    return typeof value === 'number' && isNaN(value);
  }
}

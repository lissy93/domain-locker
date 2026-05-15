import { Component, OnInit, inject } from '@angular/core';
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

interface UptimeData {
  checked_at: string;
  is_up: boolean;
  response_code: number;
  response_time_ms: number;
  dns_lookup_time_ms: number;
  ssl_handshake_time_ms: number;
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
    this.databaseService.instance.listDomains().subscribe({
      next: (domains) => {
        this.domains = domains;
        this.loadDomainSummaries();
        this.loading = false;
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

  loadDomainSummaries(): void {
    this.domains.forEach((domain) => {
      this.databaseService.instance
        .getDomainUptime(domain.user_id, domain.id, 'day')
        .then((rawData: unknown) => {
          const data = rawData as { data?: UptimeData[] } & UptimeData[];
          if (data && !data.data) data.data = data as unknown as UptimeData[]; // data be data with data has data if data not data and data is data. Got it?
          if (data.data) {
            const uptimeData: UptimeData[] = data.data;

            const sparklineData = uptimeData.map((entry: UptimeData) => ({
              x: entry.checked_at,
              y: entry.response_time_ms || 0,
            }));

            const responseCodeSummary = this.getResponseCodeSummary(uptimeData);

            const responseCodeSeries = responseCodeSummary.map((item) => item.count);
            const responseCodeLabels = responseCodeSummary.map((item) => `${item.code}`);
            const responseCodeColors = responseCodeSummary.map((item) =>
              this.getResponseCodeColor(item.code),
            );

            const uptimePercentage =
              uptimeData.length > 0
                ? (uptimeData.filter((entry: UptimeData) => entry.is_up).length /
                    uptimeData.length) *
                  100
                : 0;

            const avgResponseTime =
              uptimeData.length > 0
                ? uptimeData.reduce(
                    (sum, entry) => sum + Number(entry.response_time_ms || 0),
                    0,
                  ) / uptimeData.length
                : 0;

            const avgDnsTime =
              uptimeData.length > 0
                ? uptimeData.reduce(
                    (sum, entry) => sum + Number(entry.dns_lookup_time_ms || 0),
                    0,
                  ) / uptimeData.length
                : 0;

            const avgSslTime =
              uptimeData.length > 0
                ? uptimeData.reduce(
                    (sum, entry) => sum + Number(entry.ssl_handshake_time_ms || 0),
                    0,
                  ) / uptimeData.length
                : 0;

            this.domainSummaries.push({
              domainId: domain.id,
              domainName: domain.domain_name,
              sparklineData,
              responseCodeSummary,
              responseCodeSeries,
              responseCodeLabels,
              responseCodeColors,
              uptimePercentage,
              avgResponseTime,
              avgDnsTime,
              avgSslTime,
            });
          }
        });
    });
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

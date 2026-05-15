import { Component, OnInit, ViewChild, PLATFORM_ID, inject } from '@angular/core';
import {
  ApexOptions,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexChart,
  ApexStroke,
  ApexFill,
  ChartComponent,
  NgApexchartsModule,
  ApexTooltip,
} from 'ng-apexcharts';
import DatabaseService from '~/app/services/database.service';
import { isPlatformBrowser } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { getByEppCode } from '~/app/constants/security-categories';
import { TranslateModule } from '@ngx-translate/core';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

export interface ChartOptions {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  plotOptions: ApexPlotOptions;
  fill: ApexFill;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
}

@Component({
  standalone: true,
  selector: 'app-epp-status-chart',
  templateUrl: './domain-epp-status.component.html',
  styleUrls: ['./domain-epp-status.component.scss'],
  imports: [NgApexchartsModule, PrimeNgModule, TranslateModule],
})
export class EppStatusChartComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('epp-chart') chart: ChartComponent | undefined;
  public chartOptions!: ApexOptions;
  private totalDomainsWithEpp = 0;
  private percentages: number[] = [];
  private counts: Record<string, number> = {};
  public loading = true;
  public colors: string[] = [];

  ngOnInit(): void {
    this.setChartColors();
    this.loadEppCounts();
  }

  private setChartColors() {
    if (isPlatformBrowser(this.platformId)) {
      const style = getComputedStyle(document.body);
      this.colors = [
        style.getPropertyValue('--blue-400'),
        style.getPropertyValue('--green-400'),
        style.getPropertyValue('--yellow-400'),
        style.getPropertyValue('--cyan-400'),
        style.getPropertyValue('--indigo-400'),
        style.getPropertyValue('--teal-400'),
        style.getPropertyValue('--orange-400'),
        style.getPropertyValue('--purple-400'),
      ];
    }
  }

  private loadEppCounts() {
    const statuses = [
      'clientTransferProhibited',
      'serverTransferProhibited',
      'clientUpdateProhibited',
      'serverUpdateProhibited',
      'clientDeleteProhibited',
      'serverDeleteProhibited',
    ];

    this.databaseService.instance.getDomainsByEppCodes(statuses).subscribe({
      next: (domainsByStatus) => {
        // Collect all domain IDs across statuses into a single Set (to deduplicate them)
        const uniqueDomains = new Map<string, string>(); // Map to track domainId -> domainName

        statuses.forEach((status) => {
          domainsByStatus[status]?.forEach((domain) =>
            uniqueDomains.set(domain.domainId, domain.domainName),
          );
        });

        // Calculate the total number of unique domains with at least one EPP code
        this.totalDomainsWithEpp = uniqueDomains.size;

        // Calculate the percentage for each status
        this.percentages = statuses.map((status) => {
          const statusDomains = domainsByStatus[status] || [];
          return Math.round((statusDomains.length / this.totalDomainsWithEpp) * 100);
        });
        this.createChart();
        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to fetch EPP status counts',
          location: 'EppStatusChartComponent.loadEppCounts',
        });
      },
    });
  }

  private createChart() {
    const statuses = [
      'clientTransferProhibited',
      'serverTransferProhibited',
      'clientUpdateProhibited',
      'serverUpdateProhibited',
      'clientDeleteProhibited',
      'serverDeleteProhibited',
    ];

    this.chartOptions = {
      series: this.percentages,
      chart: {
        height: 350,
        type: 'radialBar',
      },
      plotOptions: {
        radialBar: {
          hollow: {
            margin: 5,
            size: '33%',
          },
          track: {
            background: 'var(--surface-100)',
            strokeWidth: '100%',
            margin: 5,
          },
          dataLabels: {
            name: {
              fontSize: '22px',
            },
            value: {
              fontSize: '16px',
            },
            total: {
              show: true,
              label: 'Total',
              formatter: () => {
                return `${this.totalDomainsWithEpp}`; // Show total domains with EPP
              },
            },
          },
        },
      },
      fill: {
        colors: this.colors,
      },
      tooltip: {
        enabled: true,
        custom: ({ seriesIndex }: { seriesIndex: number }) => {
          const eppCode = statuses[seriesIndex];
          const count = this.counts[eppCode];
          const category = getByEppCode(eppCode);
          const description = category?.description || '';
          return `<div style="padding:10px;">
                    <strong>${category?.label || eppCode}</strong><br>
                    Domains: ${count}<br>
                    ${description}
                  </div>`;
        },
      },
      labels: statuses.map((status) => getByEppCode(status)?.label || status),
    };
  }
}

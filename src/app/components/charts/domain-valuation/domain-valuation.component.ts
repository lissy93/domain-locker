import { Component, OnInit, inject } from '@angular/core';
import { ApexOptions, ApexAxisChartSeries, ApexYAxis } from 'ng-apexcharts';
import DatabaseService from '~/app/services/database.service';
import { Router } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { NgApexchartsModule } from 'ng-apexcharts';

import { ErrorHandlerService } from '~/app/services/error-handler.service';

interface DomainCostingPoint {
  x?: number;
  y?: number;
  z?: number;
  domainName?: string;
  tooltipInfo?: {
    purchasePrice: number;
    currentValue: number;
    renewalCost: number;
    profitLoss: number;
    autoRenew: boolean;
  };
  fillColor?: string;
}

type DomainCostingPoints = DomainCostingPoint[];

@Component({
  standalone: true,
  selector: 'app-domain-valuation-chart',
  imports: [PrimeNgModule, NgApexchartsModule],
  templateUrl: './domain-valuation.component.html',
  styleUrls: ['./domain-valuation.component.scss'],
})
export class DomainValuationChartComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);

  chartOptions: ApexOptions = {};
  dataLoaded = false;

  ngOnInit(): void {
    this.loadDomainCostings();
  }

  loadDomainCostings(): void {
    this.databaseService.instance.valuationQueries.getDomainCostings().subscribe({
      next: (domains) => {
        const autoRenewData: DomainCostingPoints = [] as DomainCostingPoints;
        const noAutoRenewData: DomainCostingPoints = [] as DomainCostingPoints;

        // Map data into two series based on auto-renew status
        domains.forEach((domain, index) => {
          const dataPoint = {
            x: domain.current_value ?? domain.purchase_price,
            y: domain.renewal_cost,
            z: Math.abs(
              (domain.current_value ?? domain.purchase_price) - domain.purchase_price,
            ),
            domainName: domain.domain_name,
            tooltipInfo: {
              purchasePrice: domain.purchase_price,
              currentValue: domain.current_value,
              renewalCost: domain.renewal_cost,
              profitLoss:
                (domain.current_value ?? domain.purchase_price) - domain.purchase_price,
              autoRenew: domain.auto_renew,
            },
            fillColor: this.getColor(index),
          };

          if (domain.auto_renew) {
            autoRenewData.push(dataPoint);
          } else {
            noAutoRenewData.push(dataPoint);
          }
        });

        this.chartOptions = this.createChartOptions(autoRenewData, noAutoRenewData);
        this.dataLoaded = true;
      },
      error: (error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to load domain costings',
          location: 'DomainValuationChartComponent.loadDomainCostings',
          showToast: true,
        });
      },
    });
  }

  createChartOptions(
    autoRenewData: DomainCostingPoints,
    noAutoRenewData: DomainCostingPoints,
  ): ApexOptions {
    return {
      chart: {
        type: 'bubble',
        height: 450,
        toolbar: { show: false },
        events: {
          dataPointSelection: (
            _event: object,
            _chartContext: object,
            config: { seriesIndex: number; dataPointIndex: number },
          ) => {
            const series = config.seriesIndex === 0 ? autoRenewData : noAutoRenewData;
            const selectedDomain = series[config.dataPointIndex];
            this.router.navigate(['/domains', selectedDomain.domainName]);
          },
        },
      },
      series: [
        {
          name: 'Auto-Renew Domains',
          data: autoRenewData as unknown as ApexAxisChartSeries[number]['data'],
          color: 'var(--teal-400)',
        },
        {
          name: 'Non-Auto-Renew Domains',
          data: noAutoRenewData as unknown as ApexAxisChartSeries[number]['data'],
          color: 'var(--red-400)',
        },
      ],
      xaxis: {
        title: { text: 'Current Value or Purchase Price' },
        labels: { formatter: (val: string) => `$${val}` },
      },
      yaxis: {
        title: 'Renewal Cost',
        labels: { formatter: (val: number) => `$${val}` },
      } as ApexYAxis,
      tooltip: {
        custom: ({
          seriesIndex,
          dataPointIndex,
        }: {
          seriesIndex: number;
          dataPointIndex: number;
        }) => {
          const series = seriesIndex === 0 ? autoRenewData : noAutoRenewData;
          const info = series[dataPointIndex].tooltipInfo;
          return info
            ? `
            <div style="padding: 10px;">
              <strong>${series[dataPointIndex].domainName}</strong><br>
              Purchase Price: $${info.purchasePrice}<br>
              Current Value: $${info.currentValue ?? 'N/A'}<br>
              Renewal Cost: $${info.renewalCost}<br>
              Profit/Loss: $${info.profitLoss}<br>
              Auto-Renew: ${info.autoRenew ? 'Yes' : 'No'}
            </div>
          `
            : '';
        },
      },
    };
  }

  // Get a color from a preset list or a color variable
  getColor(index: number): string {
    const colors = [
      'var(--red-400)',
      'var(--teal-400)',
      'var(--blue-400)',
      'var(--purple-400)',
      'var(--green-400)',
    ];
    return colors[index % colors.length];
  }
}

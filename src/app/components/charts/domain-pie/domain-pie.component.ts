import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  PLATFORM_ID,
  ElementRef,
  Input,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexNonAxisChartSeries,
  ApexChart,
  ApexResponsive,
  ApexTheme,
  ApexLegend,
  ApexStroke,
} from 'ng-apexcharts';
import DatabaseService from '~/app/services/database.service';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { TranslateModule } from '@ngx-translate/core';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

interface ChartDataItem {
  registrar_name?: string;
  name?: string;
  domain_count?: number | string;
  count?: number | string;
  issuer?: string;
  isp?: string;
  host_name?: string;
}

export interface ChartOptions {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  responsive: ApexResponsive[];
  labels: string[];
  theme: ApexTheme;
  legend: ApexLegend;
  stroke: ApexStroke;
  colors: string[];
}

@Component({
  selector: 'app-domain-pie-charts',
  templateUrl: './domain-pie.component.html',
  styleUrl: './domain-pie.component.scss',
  standalone: true,
  imports: [NgApexchartsModule, PrimeNgModule, TranslateModule],
})
export class DomainPieChartsComponent implements OnInit, AfterViewInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private platformId = inject<object>(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('registrarChart') registrarChart!: ChartComponent;
  @ViewChild('sslIssuerChart') sslIssuerChart!: ChartComponent;
  @ViewChild('hostChart') hostChart!: ChartComponent;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  @Input() listMode = false;

  public registrarChartOptions: Partial<ChartOptions> = {};
  public sslIssuerChartOptions: Partial<ChartOptions> = {};
  public hostChartOptions: Partial<ChartOptions> = {};

  public registrarDataLoaded = false;
  public sslIssuerDataLoaded = false;
  public hostDataLoaded = false;

  public registrarChartReady = false;
  public sslIssuerChartReady = false;
  public hostChartReady = false;

  public activeTabIndex = 0; // Track the active tab

  private colors: string[] = [];

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.setChartColors();
      this.loadRegistrarData();
      if (this.listMode) {
        this.loadSslIssuerData();
        this.loadHostData();
      }
    }
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.setChartSize();
    }
  }

  onTabChange(event: { index: number }) {
    this.activeTabIndex = event.index;
    if (event.index === 0) {
      this.loadRegistrarData();
    } else if (event.index === 1) {
      this.loadSslIssuerData();
    } else if (event.index === 2) {
      this.loadHostData();
    }
    setTimeout(() => this.forceChartRedraw(event.index), 100);
  }

  forceChartRedraw(index: number) {
    if (index === 0 && this.registrarChartReady) {
      this.registrarChartOptions = { ...this.registrarChartOptions };
    } else if (index === 1 && this.sslIssuerChartReady) {
      this.sslIssuerChartOptions = { ...this.sslIssuerChartOptions };
    } else if (index === 2 && this.hostChartReady) {
      this.hostChartOptions = { ...this.hostChartOptions };
    }
  }

  loadRegistrarData() {
    this.getRegistrarData()
      .pipe(
        tap((data) => {
          this.initChartOptions('registrar', data);
          this.registrarDataLoaded = true;
          this.registrarChartReady = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe();
  }

  loadSslIssuerData() {
    this.getSslIssuerData()
      .pipe(
        tap((data) => {
          this.initChartOptions('sslIssuer', data);
          this.sslIssuerDataLoaded = true;
          this.sslIssuerChartReady = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe();
  }

  loadHostData() {
    this.getHostData()
      .pipe(
        tap((data) => {
          this.initChartOptions('host', data);
          this.hostDataLoaded = true;
          this.hostChartReady = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe();
  }

  initChartOptions(
    chartType: 'registrar' | 'sslIssuer' | 'host',
    data: { name: string; count: number }[],
  ) {
    const baseOptions: Partial<ChartOptions> = {
      series: data.map((item) => item.count),
      labels: data.map((item) => item.name || 'No Data'),
      chart: {
        type: 'pie',
        background: 'transparent',
      },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: {
              width: '100%',
            },
          },
        },
      ],
      theme: {
        mode: 'dark',
        palette: 'palette1',
      },
      legend: {
        position: 'bottom',
        show: false,
        labels: {
          colors: 'var(--surface-500)',
        },
      },
      stroke: {
        colors: ['var(--surface-100)'],
      },
      colors: this.colors,
    };

    if (chartType === 'registrar') {
      this.registrarChartOptions = baseOptions;
    } else if (chartType === 'sslIssuer') {
      this.sslIssuerChartOptions = baseOptions;
    } else if (chartType === 'host') {
      this.hostChartOptions = baseOptions;
    }

    this.setChartSize();
  }

  /**
   * Normalizes chart data from different backend formats.
   * Handles both direct arrays and wrapped { data: [...] } responses.
   * Ensures domain_count is converted to a number.
   */
  private normalizeChartData(response: unknown): ChartDataItem[] {
    const data = (response as { data?: unknown })?.data ?? response;
    return Array.isArray(data) ? data : [];
  }

  getRegistrarData(): Observable<{ name: string; count: number }[]> {
    return this.databaseService.instance.registrarQueries
      .getDomainCountsByRegistrar()
      .pipe(
        map((response) => {
          const normalized = this.normalizeChartData(response);

          // Handle array of objects (self-hosted PostgreSQL format)
          if (
            Array.isArray(normalized) &&
            normalized.length > 0 &&
            typeof normalized[0] === 'object'
          ) {
            return normalized.map((item) => ({
              name: item.registrar_name ?? item.name ?? 'Unknown',
              count: Number(item.domain_count ?? item.count ?? 0),
            }));
          }

          // Handle Record<string, number> (Supabase format)
          return Object.entries(response).map(([name, count]) => ({
            name,
            count: Number(count),
          }));
        }),
        catchError((error) => {
          this.errorHandler.handleError({
            error,
            message: 'Failed to fetch registrar data',
            location: 'DomainPieChartsComponent.getRegistrarData',
          });
          return of([]);
        }),
      );
  }

  getSslIssuerData(): Observable<{ name: string; count: number }[]> {
    return this.databaseService.instance.sslQueries.getSslIssuersWithDomainCounts().pipe(
      map((response) => {
        const normalized = this.normalizeChartData(response);
        return normalized.map((item) => ({
          name: item.issuer ?? item.name ?? 'Unknown',
          count: Number(item.domain_count ?? item.count ?? 0),
        }));
      }),
      catchError((error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to fetch SSL issuer data',
          location: 'DomainPieChartsComponent.getSslIssuerData',
        });
        return of([]);
      }),
    );
  }

  getHostData(): Observable<{ name: string; count: number }[]> {
    return this.databaseService.instance.hostsQueries.getHostsWithDomainCounts().pipe(
      map((response) => {
        const normalized = this.normalizeChartData(response);
        return normalized.map((item) => ({
          name: item.isp ?? item.host_name ?? item.name ?? 'Unknown',
          count: Number(item.domain_count ?? item.count ?? 0),
        }));
      }),
      catchError((error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to fetch host data',
          location: 'DomainPieChartsComponent.getHostData',
        });
        return of([]);
      }),
    );
  }

  setChartColors() {
    if (isPlatformBrowser(this.platformId)) {
      const style = getComputedStyle(document.body);
      this.colors = [
        style.getPropertyValue('--purple-400'),
        style.getPropertyValue('--blue-400'),
        style.getPropertyValue('--green-400'),
        style.getPropertyValue('--cyan-400'),
        style.getPropertyValue('--indigo-400'),
        style.getPropertyValue('--teal-400'),
        style.getPropertyValue('--pink-400'),
        style.getPropertyValue('--yellow-400'),
        style.getPropertyValue('--orange-400'),
        style.getPropertyValue('--red-000'),
      ];
    }
  }

  setChartSize() {
    if (this.chartContainer) {
      const { width: _width, height } =
        this.chartContainer.nativeElement.getBoundingClientRect();
      const chartSize = {
        width: '90%',
        height: height,
      };
      if (this.registrarChartOptions.chart) {
        this.registrarChartOptions.chart = {
          ...this.registrarChartOptions.chart,
          ...chartSize,
        };
      }
      if (this.sslIssuerChartOptions.chart) {
        this.sslIssuerChartOptions.chart = {
          ...this.sslIssuerChartOptions.chart,
          ...chartSize,
        };
      }
      if (this.hostChartOptions.chart) {
        this.hostChartOptions.chart = { ...this.hostChartOptions.chart, ...chartSize };
      }
    }
  }
}

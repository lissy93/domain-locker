import { Component, OnInit, Input, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { NgApexchartsModule } from 'ng-apexcharts';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { ApexOptions } from 'ng-apexcharts';
import {
  getUptimeColor,
  getResponseCodeColor,
  getPerformanceColor,
} from '~/app/pages/monitor/monitor-helpers';

interface UptimeData {
  checked_at: string;
  is_up: boolean;
  response_code: number;
  response_time_ms: number;
  dns_lookup_time_ms: number;
  ssl_handshake_time_ms: number;
}
interface ResponseCode {
  code: number;
  count: number;
  percentage: number;
}
interface Series {
  x: string;
  y: number;
}
interface MinMax {
  min: number;
  max: number;
}
interface DateValue {
  date: string;
  value: number;
}
type ChartType = 'response' | 'ssl' | 'dns';
type Timeframe = 'day' | 'week' | 'month' | 'year';

@Component({
  selector: 'app-domain-sparklines',
  standalone: true,
  imports: [CommonModule, PrimeNgModule, NgApexchartsModule],
  templateUrl: './sparklines.component.html',
  styleUrls: ['./sparklines.component.scss'],
})
export class DomainSparklineComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  @Input() domainId!: string;
  @Input() userId!: string;

  timeframe: Timeframe = 'day';
  timeframeOptions: Timeframe[] = ['day', 'week', 'month', 'year'];

  advancedMode = false;

  uptimeData: UptimeData[] = [];
  isUp = false;
  uptimePercentage!: number;
  responseCodes: ResponseCode[] = [];

  // Averages for each metric for the given time frame
  avgResponseTime!: number;
  avgDnsTime!: number;
  avgSslTime!: number;

  // Ranges (min/max) for each metric for the given time frame
  minMaxResponseTime!: MinMax;
  minMaxDnsTime!: MinMax;
  minMaxSslTime!: MinMax;

  // Hovered values (will have a value if the user is hovering over a point on the chart)
  hoveredResponseTime: DateValue | null = null;
  hoveredDnsTime: DateValue | null = null;
  hoveredSslTime: DateValue | null = null;

  // Chart data
  responseTimeChart: ApexOptions = {};
  dnsTimeChart: ApexOptions = {};
  sslTimeChart: ApexOptions = {};

  getUptimeColor = getUptimeColor;
  getResponseCodeColor = getResponseCodeColor;
  getPerformanceColor = getPerformanceColor;

  ngOnInit(): void {
    this.fetchUptimeData();
  }

  fetchUptimeData(): void {
    this.databaseService.instance
      .getDomainUptime(this.userId, this.domainId, this.timeframe)
      .then((raw: unknown) => {
        const data = raw as {
          data?: UptimeData[];
          length?: number;
          error?: unknown;
        } & UptimeData[];
        if (!data.data && data.length) data.data = data; // Note to future me: I am sorry.
        if (data.data) {
          this.uptimeData = data.data;
          this.processUptimeData();
          this.processResponseCodes();
        } else {
          this.errorHandler.handleError({
            error: data?.error,
            message: 'Failed to load uptime data',
            showToast: true,
            location: 'Domain Uptime',
          });
        }
      });
  }

  /* From the db response data, puts in format ready for charts */
  processUptimeData(): void {
    if (!this.uptimeData.length) return;

    const totalChecks = this.uptimeData.length;
    const upChecks = this.uptimeData.filter((d) => d.is_up).length;
    this.isUp = this.uptimeData[0].is_up;
    this.uptimePercentage = (upChecks / totalChecks) * 100;

    const responseTimes = this.uptimeData.map((d) => ({
      x: d.checked_at,
      y: d.response_time_ms,
    }));
    const dnsTimes = this.uptimeData.map((d) => ({
      x: d.checked_at,
      y: d.dns_lookup_time_ms,
    }));
    const sslTimes = this.uptimeData.map((d) => ({
      x: d.checked_at,
      y: d.ssl_handshake_time_ms,
    }));

    this.avgResponseTime = this.calculateAverage(responseTimes.map((d) => d.y));
    this.avgDnsTime = this.calculateAverage(dnsTimes.map((d) => d.y));
    this.avgSslTime = this.calculateAverage(sslTimes.map((d) => d.y));

    this.minMaxResponseTime = this.calculateMinMax(responseTimes.map((d) => d.y));
    this.minMaxDnsTime = this.calculateMinMax(dnsTimes.map((d) => d.y));
    this.minMaxSslTime = this.calculateMinMax(sslTimes.map((d) => d.y));

    this.updateCharts(responseTimes, dnsTimes, sslTimes);
  }

  processResponseCodes(): void {
    if (!this.uptimeData.length) return;
    const responseCodeCounts: Record<number, number> = {};
    this.uptimeData.forEach(({ response_code }) => {
      if (response_code != null) {
        responseCodeCounts[response_code] = (responseCodeCounts[response_code] || 0) + 1;
      }
    });
    this.responseCodes = Object.entries(responseCodeCounts).map(([code, count]) => ({
      code: Number(code),
      count: count as number,
      percentage: Math.round((count / this.uptimeData.length) * 100),
    }));
  }

  calculateAverage(times: number[]): number {
    const filteredTimes = times.filter((t) => t != null);
    return (
      filteredTimes.reduce((acc, time) => Number(acc) + Number(time), 0) /
      filteredTimes.length
    );
  }

  calculateMinMax(times: number[]): MinMax {
    const filteredTimes = times.filter((t) => t != null);
    return {
      min: Math.min(...filteredTimes),
      max: Math.max(...filteredTimes),
    };
  }

  updateCharts(responseTimes: Series[], dnsTimes: Series[], sslTimes: Series[]): void {
    this.responseTimeChart = this.createSparklineChart(
      'response',
      responseTimes,
      '--cyan-400',
      'Response Time',
    );
    this.dnsTimeChart = this.createSparklineChart(
      'dns',
      dnsTimes,
      '--indigo-400',
      'DNS Time',
    );
    this.sslTimeChart = this.createSparklineChart(
      'ssl',
      sslTimes,
      '--purple-400',
      'SSL Time',
    );
  }

  createSparklineChart(
    id: ChartType,
    data: Series[],
    color = '--blue-400',
    name: string,
  ): ApexOptions {
    return {
      chart: {
        id,
        group: 'performance',
        type: this.advancedMode ? 'area' : 'line',
        height: this.advancedMode ? 250 : 100,
        sparkline: { enabled: false },
        events: {
          mouseMove: (event, chartContext, config) => {
            const pointIndex = config.dataPointIndex;
            if (!pointIndex || pointIndex < 0) {
              this.updateHoveredValue(null, id);
              return;
            }
            const hoveredNode = data[pointIndex];
            this.updateHoveredValue({ date: hoveredNode.x, value: hoveredNode.y }, id);
          },
          mouseLeave: () => {
            this.updateHoveredValue(null, id);
          },
        },
        zoom: {
          enabled: this.advancedMode ? true : false,
        },
      },
      dataLabels: {
        enabled: this.timeframe === 'day' && this.advancedMode,
      },
      colors: [`var(${color}, #60a5fa)`],
      fill: this.advancedMode
        ? {
            type: 'gradient',
            gradient: {
              shadeIntensity: 1,
              opacityFrom: 0.5,
              opacityTo: 0,
              stops: [0, 70, 100],
            },
          }
        : {},
      series: [
        {
          name,
          data,
          color: `var(${color})`,
        },
      ],
      stroke: {
        curve: 'smooth',
        width: this.advancedMode ? 3 : 2,
        colors: [`var(${color}, #60a5fa)`],
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        x: {
          format: 'dd MMM HH:mm',
        },
        y: {
          formatter: (value: number) => (value ? `${value.toFixed(2)} ms` : 'N/A'),
        },
      },
      xaxis: {
        type: 'datetime',
      },
      yaxis: {
        labels: {
          formatter: (value: number) => `${this.round(value)}`,
        },
      },
    };
  }

  updateHoveredValue(
    hoveredNode: DateValue | null,
    chartType: ChartType | null = null,
  ): void {
    const { date, value } = hoveredNode || {};
    if (!value || !date || !chartType) {
      const triggerChange = !!(
        this.hoveredResponseTime ||
        this.hoveredDnsTime ||
        this.hoveredSslTime
      );
      if (triggerChange) {
        this.hoveredResponseTime = null;
        this.hoveredDnsTime = null;
        this.hoveredSslTime = null;
        this.cdr.detectChanges();
      }
      return;
    }
    switch (chartType) {
      case 'response':
        this.hoveredResponseTime = { date, value };
        break;
      case 'dns':
        this.hoveredDnsTime = { date, value };
        break;
      case 'ssl':
        this.hoveredSslTime = { date, value };
        break;
    }
    this.cdr.detectChanges();
  }

  onTimeframeChange(timeframe: string): void {
    this.timeframe = timeframe as Timeframe;
    this.fetchUptimeData();
  }

  public onAdvancedModeChange(): void {
    this.processUptimeData();
    this.processResponseCodes();
  }

  public round(value: number | undefined | null): number {
    if (!value || isNaN(value)) {
      return 0;
    }
    return Math.round(value * 100) / 100;
  }

  public mapTimeToSentence(timeframe: Timeframe): string {
    switch (timeframe) {
      case 'day':
        return 'past 24 hours';
      case 'week':
        return 'past 7 days';
      case 'month':
        return 'past 30 days';
      case 'year':
        return 'past 12 months';
      default:
        return 'Unknown';
    }
  }

  public formatTimeStamp(timestamp: string): string {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return date.toLocaleString('en-US', options).replace(',', '');
  }
}

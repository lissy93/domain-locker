import { Component, OnInit, Input, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { NgApexchartsModule } from 'ng-apexcharts';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { ApexOptions } from 'ng-apexcharts';

interface UptimeData {
  checked_at: string;
  is_up: boolean;
  response_code: number | null;
  response_time_ms: number | null;
}

interface DailyUptime {
  day: string; // YYYY-MM-DD (UTC)
  avg_response_time_ms: number | null;
}

interface HeatmapCell {
  x: string;
  y: number | null;
  fullDate: string | null;
}

@Component({
  selector: 'app-uptime-history',
  standalone: true,
  imports: [PrimeNgModule, NgApexchartsModule],
  templateUrl: './uptime-history.component.html',
  styleUrls: ['./uptime-history.component.scss'],
})
export class UptimeHistoryComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);

  @Input() domainId!: string;
  @Input() userId!: string;

  // 52 weekly columns ending on the current week, fetched with a little slack
  private readonly calendarWeeks = 52;
  private readonly calendarDays = this.calendarWeeks * 7 + 7;

  dailyData: DailyUptime[] = [];
  uptimeData: UptimeData[] = [];
  calendarHeatmap: ApexOptions | null = null;
  responseCodePieChart: ApexOptions | null = null;
  calendarError = false;

  ngOnInit(): void {
    this.fetchDailyUptime();
    this.fetchResponseCodes();
  }

  /* Daily averages power the calendar heatmap */
  fetchDailyUptime(): void {
    this.databaseService.instance
      .getDomainUptimeDaily(this.userId, this.domainId, this.calendarDays)
      .then((data) => {
        this.dailyData = data || [];
        this.generateCalendarHeatmap();
      })
      .catch((error) => {
        this.calendarError = true;
        this.errorHandler.handleError({
          error,
          message: 'Failed to load uptime history',
          showToast: true,
          location: 'Uptime History',
        });
      });
  }

  /* Raw checks power the response-code distribution */
  fetchResponseCodes(): void {
    this.databaseService.instance
      .getDomainUptime(this.userId, this.domainId, 'year')
      .then((raw: unknown) => {
        const data = raw as {
          data?: UptimeData[];
          length?: number;
          error?: unknown;
        } & UptimeData[];
        if (!data.data && data.length) data.data = data;
        if (data.data) {
          this.uptimeData = data.data;
          this.generateResponseCodePieChart();
        } else {
          this.errorHandler.handleError({
            error: data?.error,
            message: 'Failed to load response codes',
            showToast: false,
            location: 'Uptime History',
          });
        }
      });
  }

  /* Build a GitHub-style calendar: 7 weekday rows over the past year of weeks */
  generateCalendarHeatmap(): void {
    const valueByDay = new Map<string, number | null>();
    this.dailyData.forEach((entry) =>
      valueByDay.set(entry.day, entry.avg_response_time_ms),
    );

    const today = this.startOfTodayUtc();
    const start = new Date(today);
    start.setUTCDate(
      today.getUTCDate() - today.getUTCDay() - 7 * (this.calendarWeeks - 1),
    );

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const series = dayNames.map((name, weekday) => ({
      name,
      data: Array.from({ length: this.calendarWeeks }, (_, week): HeatmapCell => {
        const weekStart = new Date(start);
        weekStart.setUTCDate(start.getUTCDate() + week * 7);
        const cellDate = new Date(weekStart);
        cellDate.setUTCDate(weekStart.getUTCDate() + weekday);
        const x = this.toDayString(weekStart);
        if (cellDate > today) {
          return { x, y: null, fullDate: null };
        }
        const value = valueByDay.get(this.toDayString(cellDate));
        return { x, y: value == null ? -1 : value, fullDate: this.toDayString(cellDate) };
      }),
    }));

    this.calendarHeatmap = {
      chart: { type: 'heatmap', height: 220 },
      plotOptions: {
        heatmap: { shadeIntensity: 1, colorScale: { ranges: this.heatmapRanges() } },
      },
      dataLabels: { enabled: false },
      stroke: { width: 2 },
      xaxis: {
        type: 'category',
        labels: {
          rotate: 0,
          hideOverlappingLabels: true,
          formatter: (value: string) => this.monthLabel(value),
        },
        tooltip: { enabled: false },
      },
      tooltip: { enabled: true, custom: this.heatmapTooltip },
      series,
    };
  }

  generateResponseCodePieChart(): void {
    const codeCounts: Record<string, number> = {};

    this.uptimeData.forEach(({ response_code, is_up }) => {
      const statusCode = response_code ?? (is_up ? 200 : 500);
      const statusKey = `${statusCode}`;
      codeCounts[statusKey] = (codeCounts[statusKey] || 0) + 1;
    });

    const series = Object.values(codeCounts);
    const labels = Object.keys(codeCounts);
    const colors = labels.map((code) => this.getResponseCodeColor(Number(code)));

    this.responseCodePieChart = {
      chart: { type: 'pie', height: 300 },
      series,
      labels,
      colors,
      tooltip: {
        y: {
          formatter: (value: number) =>
            `${value} checks (${((value / this.uptimeData.length) * 100).toFixed(2)}%)`,
        },
      },
      legend: { position: 'bottom' },
    };
  }

  private heatmapRanges() {
    return [
      {
        from: -Infinity,
        to: -1,
        color: this.getCssVariableColor('--grey-400', '#cccccc'),
        name: 'No checks',
      },
      {
        from: 0,
        to: 250,
        color: this.getCssVariableColor('--green-400', '#22c55e'),
        name: 'Fast',
      },
      {
        from: 251,
        to: 500,
        color: this.getCssVariableColor('--yellow-400', '#eab308'),
        name: 'Moderate',
      },
      {
        from: 501,
        to: 1000,
        color: this.getCssVariableColor('--orange-400', '#f97316'),
        name: 'Slow',
      },
      {
        from: 1001,
        to: Infinity,
        color: this.getCssVariableColor('--red-400', '#ef4444'),
        name: 'Very Slow',
      },
    ];
  }

  /* Tooltip showing the exact day and its average response time */
  private heatmapTooltip = ({
    seriesIndex,
    dataPointIndex,
    w,
  }: {
    seriesIndex: number;
    dataPointIndex: number;
    w: { globals: { initialSeries: { data: HeatmapCell[] }[] } };
  }): string => {
    const point = w.globals.initialSeries[seriesIndex]?.data[dataPointIndex];
    if (!point || point.fullDate == null) return '';
    const date = new Date(`${point.fullDate}T00:00:00Z`);
    const label = date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const value =
      point.y === -1
        ? '<span style="color: var(--grey-400)">No checks</span>'
        : `<span style="color: var(--cyan-400)">${(point.y as number).toFixed(2)} ms</span>`;
    return `<div class="tooltip-text"><strong>${label}</strong>: ${value}</div>`;
  };

  getResponseCodeColor(code: number, prefix = ''): string {
    if (code >= 200 && code < 300) return `var(--${prefix}green-400)`;
    if (code >= 300 && code < 400) return `var(--${prefix}blue-400)`;
    if (code >= 400 && code < 500) return `var(--${prefix}yellow-400)`;
    if (code >= 500) return `var(--${prefix}red-400)`;
    return `var(--${prefix}grey-400)`;
  }

  /* Midnight UTC today, so day keys line up with the DB's day grouping */
  private startOfTodayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private toDayString(date: Date): string {
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${date.getUTCFullYear()}-${month}-${day}`;
  }

  /* Short month name on the first week-column of each month, else blank */
  private monthLabel(weekStartIso: string): string {
    const date = new Date(`${weekStartIso}T00:00:00Z`);
    const prev = new Date(date);
    prev.setUTCDate(date.getUTCDate() - 7);
    return date.getUTCMonth() !== prev.getUTCMonth()
      ? date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
      : '';
  }

  /* Gets the hex color value of a CSS variable */
  getCssVariableColor(cssVarName: string, fallback = '#cccccc'): string {
    if (typeof window === 'undefined' || !window?.getComputedStyle) {
      return fallback;
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const value = rootStyles.getPropertyValue(cssVarName)?.trim();
    return /^#([0-9A-F]{3}){1,2}$/i.test(value) ? value : fallback;
  }
}

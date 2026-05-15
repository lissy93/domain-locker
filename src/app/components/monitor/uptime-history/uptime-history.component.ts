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

  uptimeData: UptimeData[] = [];
  calendarHeatmap: ApexOptions | null = null;
  responseCodePieChart: ApexOptions | null = null;

  ngOnInit(): void {
    this.fetchUptimeHistory();
  }

  fetchUptimeHistory(): void {
    this.databaseService.instance
      .getDomainUptime(this.userId, this.domainId, 'year')
      .then((raw: unknown) => {
        const data = raw as {
          data?: UptimeData[];
          length?: number;
          error?: unknown;
        } & UptimeData[];
        if (!data.data && data.length) data.data = data; // wtf.
        if (data.data) {
          this.uptimeData = data.data;
          this.generateCalendarHeatmap();
          this.generateResponseCodePieChart();
        } else {
          this.errorHandler.handleError({
            error: data?.error,
            message: 'Failed to load uptime history',
            showToast: true,
            location: 'Uptime History',
          });
        }
      });
  }

  generateCalendarHeatmap(): void {
    const daysInYear = this.getDaysInPastYear();
    const groupedByDay: Record<string, number[]> = {};

    // Group response times by day
    this.uptimeData.forEach((entry) => {
      const day = new Date(entry.checked_at).toISOString().split('T')[0]; // YYYY-MM-DD
      if (!groupedByDay[day]) groupedByDay[day] = [];
      if (entry.response_time_ms) groupedByDay[day].push(entry.response_time_ms);
    });

    // Calculate daily averages
    const dailyAverages = daysInYear.map((day) => ({
      day,
      avgResponseTime: groupedByDay[day]?.length
        ? groupedByDay[day].reduce((sum, time) => Number(sum) + Number(time), 0) /
          groupedByDay[day].length
        : null,
    }));

    // Split data into 7 series (one for each day of the week)
    const series = Array.from({ length: 7 }, (_, i) => ({
      name: this.getDayName(i),
      data: dailyAverages
        .filter((item) => new Date(item.day).getDay() === i)
        .map((item) => ({
          x: this.getWeekOfYear(item.day),
          y: item.avgResponseTime ?? -1,
          fullDate: item.day,
        })),
    }));

    // Configure the heatmap chart
    this.calendarHeatmap = {
      chart: {
        type: 'heatmap',
        height: 220,
      },
      plotOptions: {
        heatmap: {
          shadeIntensity: 1,
          colorScale: {
            ranges: [
              {
                from: -Infinity,
                to: -1,
                color: this.getCssVariableColor('--grey-400', '#cccccc'),
                name: 'No Results Yet',
              },
              {
                from: 0,
                to: 250,
                color: this.getCssVariableColor('--green-400', '#00ff00'),
                name: 'Fast',
              },
              {
                from: 251,
                to: 500,
                color: this.getCssVariableColor('--yellow-400', '#ffff00'),
                name: 'Moderate',
              },
              {
                from: 501,
                to: 1000,
                color: this.getCssVariableColor('--orange-400', '#ff9900'),
                name: 'Slow',
              },
              {
                from: 1001,
                to: Infinity,
                color: this.getCssVariableColor('--red-400', '#ff0000'),
                name: 'Very Slow',
              },
            ],
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      xaxis: {
        type: 'category',
        categories: Array.from({ length: 52 }, (_, i) => `Week ${i + 1}`),
        title: {
          text: 'Week of the Year',
        },
      },
      tooltip: {
        enabled: true,
        custom: ({
          seriesIndex,
          dataPointIndex,
          w,
        }: {
          series: unknown;
          seriesIndex: number;
          dataPointIndex: number;
          w: {
            globals: { initialSeries: { data: { y: number; fullDate: string }[] }[] };
          };
        }) => {
          const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
          if (data.y === -1) {
            return `<div class="tooltip-text">
              <span style="color: var(--grey-400)">No Results Yet</span>
            </div>`;
          }
          const date = new Date(data.fullDate);
          const day = date.toLocaleDateString('en-US', {
            weekday: 'short',
          });
          const month = date.toLocaleDateString('en-US', {
            month: 'short',
          });
          const dayOfMonth = date.getDate();
          const ordinalSuffix = this.getOrdinalSuffix(dayOfMonth);

          return `<div class="tooltip-text">
            <strong>${day} ${dayOfMonth}${ordinalSuffix} ${month}</strong>: 
            <span style="color: var(--cyan-400)">${data.y.toFixed(2)} ms</span>
          </div>`;
        },
      },
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
      chart: {
        type: 'pie',
        height: 300,
      },
      series,
      labels,
      colors,
      tooltip: {
        y: {
          formatter: (
            value: number,
            { seriesIndex: _seriesIndex }: { seriesIndex: number },
          ) =>
            `${value} checks (${((value / this.uptimeData.length) * 100).toFixed(2)}%)`,
        },
      },
      legend: {
        position: 'bottom',
      },
    };
  }

  getResponseCodeColor(code: number, prefix = ''): string {
    if (code >= 200 && code < 300) return `var(--${prefix}green-400)`; // Green for success
    if (code >= 300 && code < 400) return `var(--${prefix}blue-400)`; // Blue for redirects
    if (code >= 400 && code < 500) return `var(--${prefix}yellow-400)`; // Yellow for client errors
    if (code >= 500) return `var(--${prefix}red-400)`; // Red for server errors
    return `var(--${prefix}grey-400)`; // Grey for unknown
  }

  /**
   * Helper function to get the ordinal suffix for a number (e.g., 1st, 2nd, 3rd).
   */
  getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }

  /**
   * Gets all days in the past year.
   * @returns An array of strings in the format YYYY-MM-DD.
   */
  getDaysInPastYear(): string[] {
    const days: string[] = [];
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date.toISOString().split('T')[0]); // YYYY-MM-DD
    }
    return days.reverse(); // Order from oldest to newest
  }

  /**
   * Gets the day name for a given index (0 = Sunday, 1 = Monday, ...).
   */
  getDayName(index: number): string {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'][index];
  }

  /**
   * Gets the week of the year for a given date.
   */
  getWeekOfYear(date: string): number {
    const currentDate = new Date(date);
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const diff = currentDate.getTime() - startOfYear.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }

  /**
   * Gets the hex color value of a CSS variable.
   */
  getCssVariableColor(cssVarName: string, fallback = '#cccccc'): string {
    if (typeof window === 'undefined' || !window?.getComputedStyle) {
      return fallback;
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const value = rootStyles.getPropertyValue(cssVarName)?.trim();
    return /^#([0-9A-F]{3}){1,2}$/i.test(value) ? value : fallback;
  }
}

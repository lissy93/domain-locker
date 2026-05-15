import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { serviceLinks, type LinkItem } from '~/app/constants/admin-links';

export interface StatusSummary {
  service: string;
  status: string;
  details: string;
  link?: string;
  serviceMeta?: LinkItem;
}

export interface StatusLog {
  service: string;
  date: string;
  details: string;
  link: string;
  severity: string;
  serviceMeta?: LinkItem;
}

export interface StatusData {
  summary: StatusSummary[];
  history: StatusLog[];
  scheduled: StatusLog[];
}

export interface ScheduledCron {
  name: string;
  desc?: string;
  status: string;
  last_ping?: string;
  last_duration?: number;
  next_ping?: string | null;
  n_pings?: number;
}

export interface DatabaseHealth {
  up?: boolean;
  db?: boolean;
  env?: boolean;
}

export interface InternalStatus {
  scheduled: ScheduledCron[];
  supabase: { healthy: boolean; undetermined?: boolean };
  uptime: Record<string, unknown>;
  database: DatabaseHealth;
  ghActions?: {
    id: number;
    name: string;
    path: string;
    state: string;
    conclusion:
      | 'success'
      | 'failure'
      | 'cancelled'
      | 'skipped'
      | 'timed_out'
      | 'action_required'
      | 'neutral'
      | 'stale'
      | 'startup_failure';
    badge_url: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    status: 'queued' | 'in_progress' | 'completed';
    run_id: number;
    run_html_url: string;
    head_branch: string;
    run_event: string;
  }[];
}

interface HeartBeat {
  status: number;
  time: string;
  msg?: string;
  ping: number;
}

interface StatusMetrics {
  uptimePercent: number;
  averagePing: number;
  minPing: number;
  maxPing: number;
}

@Component({
  standalone: true,
  selector: 'app-advanced-status-page',
  imports: [CommonModule, PrimeNgModule, DomainFaviconComponent],
  templateUrl: './status.page.html',
  styles: [
    `
      li details p {
        border-left: 4px solid var(--primary-300);
        padding: 0.25rem 0.5rem;
        margin: 0.25rem 0.5rem 0.75rem 0.5rem !important;
      }
    `,
  ],
})
export default class StatusPage {
  private http = inject(HttpClient);
  private errorHandler = inject(ErrorHandlerService);

  readonly statusInfo$: Observable<StatusData> = this.fetchStatusData();
  readonly internalStatusInfo$: Observable<InternalStatus> =
    this.fetchInternalStatusData();
  public historyChartUrl = '';
  public pieChartUrl = '';

  // Toggle flags for showing more/less incidents.
  public showAllHistory = false;
  public showAllScheduled = false;

  public dlServicesToSetup: string[] = ['App', 'API', 'Database', 'Auth', 'Scheduler'];

  readonly uptimeServiceMap: Record<string, string> = {
    '5': 'Landing',
    '6': 'Main App',
    '7': 'Docs',
  };

  // public uptimeExtraInfo

  public uptimeChartUrl = '';
  public currentStatuses: {
    id: string;
    name: string;
    status: boolean;
    latestPing?: number;
    extraInfo?: StatusMetrics | null;
  }[] = [];

  constructor() {
    // Generate the chart once we have API data.
    this.statusInfo$.subscribe((data) => {
      const chartConfig = this.generateChartConfig(data, {
        daysBefore: 7,
        daysAfter: 7,
        title: 'Incident History',
      });
      this.historyChartUrl =
        'https://quickchart.io/chart?c=' +
        encodeURIComponent(JSON.stringify(chartConfig));
      const servicePieConfig = this.generatePieChartConfig(data, 'service', {
        title: 'Issues per Service',
      });
      this.pieChartUrl =
        'https://quickchart.io/chart?c=' +
        encodeURIComponent(JSON.stringify(servicePieConfig));
    });

    this.internalStatusInfo$.subscribe(this.uptimeDataProcess.bind(this));
  }

  private fetchInternalStatusData(): Observable<InternalStatus> {
    return this.http
      .get<{
        scheduledCrons?: ScheduledCron[];
        supabaseStatus?: { healthy: boolean; undetermined?: boolean };
        uptimeStatus?: Record<string, unknown>;
        databaseStatus?: DatabaseHealth;
        ghActions?: InternalStatus['ghActions'];
      }>('/api/internal-status-info')
      .pipe(
        map((data) => ({
          scheduled: data.scheduledCrons || [],
          supabase: data.supabaseStatus || { healthy: false, undetermined: true },
          uptime: data.uptimeStatus || {},
          database: data.databaseStatus || {},
          ghActions: data.ghActions || [],
        })),
        catchError((error) => {
          this.errorHandler.handleError({
            error,
            message: 'Failed to load internal status data',
            location: 'internal-status-info',
            showToast: true,
          });
          return of<InternalStatus>({
            scheduled: [],
            supabase: { healthy: false },
            uptime: {},
            database: {},
            ghActions: [],
          });
        }),
      );
  }

  private fetchStatusData(): Observable<StatusData> {
    return this.http.get<StatusData>('/api/external-status-info').pipe(
      map((data) => ({
        summary: this.enrichList(data.summary),
        history: this.enrichList(data.history),
        scheduled: this.enrichList(data.scheduled),
      })),
      catchError((error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to load status data',
          location: 'status-info',
          showToast: true,
        });
        return of({ summary: [], history: [], scheduled: [] });
      }),
    );
  }

  private enrichList<T extends { service: string }>(list: T[]): T[] {
    return list.map((item) => ({
      ...item,
      serviceMeta: serviceLinks.find(
        (link) => link.provider.toLowerCase() === item.service.toLowerCase(),
      ),
    }));
  }

  private getCssVariableColor = (cssVarName: string, fallback = '#cccccc'): string => {
    if (typeof window === 'undefined' || !window?.getComputedStyle) {
      return fallback;
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const value = rootStyles.getPropertyValue(cssVarName)?.trim();
    return /^#([0-9A-F]{3}){1,2}$/i.test(value) ? value : fallback;
  };

  private calculateStatusMetrics(
    heartbeats: HeartBeat[] | undefined,
  ): StatusMetrics | null {
    if (!heartbeats || heartbeats.length === 0) return null;

    const successful = heartbeats.filter((h) => h.status === 1);
    const pings = successful.map((h) => h.ping).filter((p) => typeof p === 'number');

    if (pings.length === 0) return null;

    const uptimePercent = Math.round((successful.length / heartbeats.length) * 100);
    const averagePing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
    const minPing = Math.min(...pings);
    const maxPing = Math.max(...pings);

    return { uptimePercent, averagePing, minPing, maxPing };
  }

  /**
   * Generates a Chart.js configuration object for a stacked bar chart.
   *
   * The chart shows, for each day:
   *  - History incidents grouped into Critical (red), Minor (orange), and Other (yellow).
   *  - Scheduled (upcoming) incidents (in purple pattern).
   *  - A line dataset for the total issues.
   *
   * Configurable options include the number of days before and after today, and the chart title.
   */
  private generateChartConfig(
    statusData: StatusData,
    options?: { daysBefore?: number; daysAfter?: number; title?: string },
  ): Record<string, unknown> {
    // Configurable options.
    const DAYS_BEFORE = options?.daysBefore ?? 7;
    const DAYS_AFTER = options?.daysAfter ?? 7;
    const chartTitle = options?.title ?? 'Incident History';

    const totalDays = DAYS_BEFORE + DAYS_AFTER + 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - DAYS_BEFORE);

    // Prepare labels and initialize counts.
    const labels: string[] = [];
    const criticalData = new Array(totalDays).fill(0);
    const minorData = new Array(totalDays).fill(0);
    const otherData = new Array(totalDays).fill(0);
    const upcomingData = new Array(totalDays).fill(0);
    const totalData = new Array(totalDays).fill(0);

    // Helper to format a date as "May 01".
    const formatLabel = (d: Date): string => {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit' };
      return d.toLocaleDateString('en-US', options);
    };

    // Generate labels.
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      labels.push(formatLabel(d));
    }

    // Helper to compute day index in our date range.
    const getDayIndex = (d: Date): number => {
      const diffTime = d.getTime() - startDate.getTime();
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    // Process history items (past and present only).
    statusData.history.forEach((item) => {
      const d = new Date(item.date);
      d.setHours(0, 0, 0, 0);
      const idx = getDayIndex(d);
      if (idx < 0 || idx >= totalDays) return;
      // Categorize: if severity contains "critical" or equals ❌, etc.
      const sev = item.severity.toLowerCase();
      if (sev.includes('critical') || sev === '❌') {
        criticalData[idx]++;
      } else if (sev.includes('minor') || sev === '⚠️') {
        minorData[idx]++;
      } else {
        otherData[idx]++;
      }
    });

    // Process scheduled items (future only).
    statusData.scheduled.forEach((item) => {
      const d = new Date(item.date);
      d.setHours(0, 0, 0, 0);
      const idx = getDayIndex(d);
      if (idx < 0 || idx >= totalDays) return;
      if (d.getTime() > today.getTime()) {
        upcomingData[idx]++;
      }
    });

    // Calculate total issues for each day.
    for (let i = 0; i < totalDays; i++) {
      totalData[i] = criticalData[i] + minorData[i] + otherData[i] + upcomingData[i];
    }

    // Colors and styling (adjustable).
    const criticalColor = this.getCssVariableColor('--red-400', '#E92546');
    const minorColor = this.getCssVariableColor('--orange-400', '#EF9126');
    const otherColor = this.getCssVariableColor('--yellow-400', '#D9ED07');
    const upcomingColor = this.getCssVariableColor('--blue-400', '#a78bfa');
    const totalColor = this.getCssVariableColor('--teal-400', '#36a2eb');

    // Build the Chart.js configuration.
    const config = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Total',
            borderColor: totalColor,
            borderWidth: 2,
            fill: false,
            data: totalData,
          },
          {
            label: 'Critical',
            backgroundColor: criticalColor,
            data: criticalData,
          },
          {
            label: 'Minor',
            backgroundColor: minorColor,
            data: minorData,
          },
          {
            label: 'Other',
            backgroundColor: otherColor,
            data: otherData,
          },
          {
            label: 'Upcoming',
            data: upcomingData,
            // backgroundColor: `pattern.draw('diagonal-right-left', '${upcomingColor}')`,
            backgroundColor: upcomingColor,
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: chartTitle,
          fontColor: this.getCssVariableColor('--text-color', '#6d6d6d'),
        },
        scales: {
          xAxes: [{ stacked: true }],
          yAxes: [{ stacked: true }],
        },
        annotation: {
          annotations: [
            {
              type: 'line',
              mode: 'vertical',
              scaleID: 'x-axis-0',
              value: DAYS_BEFORE,
              borderColor: upcomingColor,
              borderWidth: 3,
              backgroundColor: 'rgba(109, 109, 109, 0.2)',
              label: {
                enabled: true,
                content: 'Today',
              },
            },
          ],
        },
      },
    };
    return config;
  }

  /**
   * Generates a Pie Chart configuration.
   *
   * @param statusData The complete status data from your API.
   * @param breakdownType 'service' for total issues per service
   *                      'severity' for issues aggregated by severity.
   * @param options Configurable options (currently supports chart title).
   *
   * @returns A Chart.js configuration object.
   */
  private generatePieChartConfig(
    statusData: StatusData,
    breakdownType: 'service' | 'severity',
    options?: { title?: string },
  ): Record<string, unknown> {
    // Combine both history and scheduled items.
    const allItems = [...statusData.history, ...statusData.scheduled];
    const counts: Record<string, number> = {};

    if (breakdownType === 'service') {
      // Count total issues per service.
      allItems.forEach((item) => {
        const key = item.service;
        counts[key] = (counts[key] || 0) + 1;
      });
      const labels = Object.keys(counts);
      const data = labels.map((label) => counts[label]);
      // Default palette for services.
      const palette = [
        this.getCssVariableColor('--blue-400', '#36A2EB'),
        this.getCssVariableColor('--teal-400', '#4BC0C0'),
        this.getCssVariableColor('--purple-400', '#9966FF'),
        this.getCssVariableColor('--orange-400', '#FF9F40'),
        this.getCssVariableColor('--red-400', '#E92546'),
        this.getCssVariableColor('--yellow-400', '#FFD700'),
        this.getCssVariableColor('--green-400', '#4CAF50'),
        this.getCssVariableColor('--pink-400', '#FF4081'),
        this.getCssVariableColor('--indigo-400', '#3F51B5'),
        this.getCssVariableColor('--gray-400', '#9E9E9E'),
        this.getCssVariableColor('--cyan-400', '#00BCD4'),
        this.getCssVariableColor('--purple-400', '#CDDC39'),
      ];
      const backgroundColor = labels.map((_, i) => palette[i % palette.length]);

      return {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              backgroundColor: backgroundColor,
            },
          ],
        },
        options: {
          title: {
            display: true,
            text: options?.title || 'Issues per Service',
            fontColor: this.getCssVariableColor('--text-color', '#6d6d6d'),
          },
        },
      };
    } else if (breakdownType === 'severity') {
      // Count issues per severity.
      allItems.forEach((item) => {
        const key = item.severity.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      });
      const labels = Object.keys(counts);
      const data = labels.map((label) => counts[label]);
      // Map severity keys to fixed colors.
      const severityColors: Record<string, string> = {
        critical: '#E92546',
        minor: '#EF9126',
        info: '#36A2EB',
        operational: '#4BC0C0',
        unknown: '#999999',
        upcoming: '#a78bfa',
      };
      const backgroundColor = labels.map((label) => severityColors[label] || '#FFD700');

      return {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              backgroundColor: backgroundColor,
            },
          ],
        },
        options: {
          title: {
            display: true,
            text: options?.title || 'Issues by Severity',
            fontColor: this.getCssVariableColor('--text-color', '#6d6d6d'),
          },
        },
      };
    }
    return {};
  }

  private uptimeDataProcess(internal: InternalStatus): void {
    const rawHeartbeats =
      (internal.uptime as { heartbeatList?: Record<string, HeartBeat[]> })
        ?.heartbeatList || {};
    const statusData: typeof this.currentStatuses = [];

    const chartColors = [
      '--purple-400',
      '--teal-400',
      '--pink-400',
      '--blue-400',
      '--yellow-400',
      '--green-400',
    ];

    const datasets = Object.entries(rawHeartbeats).map(([id, heartbeats], i) => {
      const serviceName = this.uptimeServiceMap[id] || `Service ${id}`;
      const latest = (heartbeats as HeartBeat[]).at(-1);

      statusData.push({
        id,
        name: serviceName,
        status: latest?.status === 1,
        latestPing: latest?.ping,
        extraInfo: this.calculateStatusMetrics(heartbeats as HeartBeat[]),
      });

      return {
        label: serviceName,
        data: (heartbeats as HeartBeat[]).map((h) => ({
          x: h.time.replace(' ', 'T') + 'Z',
          y: h.ping,
        })),
        borderColor: this.getCssVariableColor(
          chartColors[i % chartColors.length],
          '#36A2EB',
        ),
        fill: false,
        spanGaps: false,
        tension: 0.4,
      };
    });

    this.currentStatuses = statusData;

    // Just using the first dataset's timestamps to generate HH:mm labels
    const firstDataset = datasets[0]?.data || [];
    const labels = firstDataset.map((point: { x: string }) => {
      const date = new Date(point.x);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    });

    const chartConfig = {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        title: {
          display: true,
          text: 'Domain Locker Uptime',
          color: this.getCssVariableColor('--text-color', '#333'),
        },
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Service Response Time',
            color: this.getCssVariableColor('--text-color', '#333'),
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Ping (ms)',
            },
          },
        },
      },
    };

    this.uptimeChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
  }
}

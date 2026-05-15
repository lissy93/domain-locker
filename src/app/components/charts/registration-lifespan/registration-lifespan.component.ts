import {
  Component,
  OnInit,
  Input,
  AfterViewInit,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

interface Domain {
  id: number;
  name: string;
  start: Date;
  end: Date;
}

@Component({
  standalone: true,
  selector: 'app-domain-gantt-chart',
  templateUrl: './registration-lifespan.component.html',
  styleUrls: ['./registration-lifespan.component.scss'],
  imports: [PrimeNgModule, CommonModule],
})
export class DomainGanttChartComponent implements OnInit, AfterViewInit {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  @Input() groupDates = false;

  domains: Domain[] = [];
  yearRange: string[] = [];
  todayPosition = '';
  loading = true;

  private readonly colors = [
    'var(--red-400)',
    'var(--blue-400)',
    'var(--green-400)',
    'var(--purple-400)',
    'var(--yellow-400)',
    'var(--orange-400)',
  ];

  ngOnInit() {
    this.loadDomains();
    this.setYearRange();
  }

  ngAfterViewInit() {
    this.calculateTodayPosition();
    this.cdr.detectChanges(); // Trigger change detection after setting values
  }

  private loadDomains() {
    this.databaseService.instance.listDomains().subscribe({
      next: (domains) => {
        this.domains = domains.map((domain, index) => ({
          id: index,
          name: domain.domain_name,
          start: new Date(domain.registration_date || new Date()),
          end: new Date(domain.expiry_date || new Date()),
        }));
        this.loading = false;
      },
      error: (error: Error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to load domains',
          location: 'DomainGanttChartComponent.loadDomains',
          showToast: true,
        });
        this.loading = false;
      },
    });
  }

  private setYearRange() {
    const startYear = 1990;
    const endYear = new Date().getFullYear() + 10;
    const years = Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i,
    );

    this.yearRange = this.groupDates
      ? years.reduce<string[]>((ranges, year, i) => {
          if (i % 5 === 0) ranges.push(`${year}-${String(year + 4).slice(-2)}`);
          return ranges;
        }, [])
      : years.map((year) => year.toString());
  }

  calculateBarPosition(domain: Domain): {
    left: string;
    width: string;
    pastWidth: string;
    daysUntilExpiration: number;
    daysSinceRegistration: number;
  } {
    const startYear = parseInt(this.yearRange[0]);
    const yearsSpan = this.yearRange.length * (this.groupDates ? 5 : 1);

    const startPos = ((domain.start.getFullYear() - startYear) / yearsSpan) * 100;
    const duration =
      ((domain.end.getFullYear() - domain.start.getFullYear()) / yearsSpan) * 100;

    const today = new Date();

    const daysSinceRegistration = Math.floor(
      (today.getTime() - domain.start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysUntilExpiration = Math.floor(
      (domain.end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    let pastWidth = '0%';
    if (today > domain.start) {
      const pastDuration =
        (Math.min(today.getTime(), domain.end.getTime()) - domain.start.getTime()) /
        (domain.end.getTime() - domain.start.getTime());
      pastWidth = `${Math.round(pastDuration * 100)}%`;
    }

    return {
      left: `${Math.round(startPos)}%`,
      width: `${Math.round(duration)}%`,
      pastWidth,
      daysSinceRegistration,
      daysUntilExpiration,
    };
  }

  private calculateTodayPosition() {
    const startYear = parseInt(this.yearRange[0]);
    const yearsSpan = this.yearRange.length * (this.groupDates ? 5 : 1);
    const currentYear = new Date().getFullYear();
    this.todayPosition = `${Math.round(((currentYear - startYear) / yearsSpan) * 100)}%`;
  }

  getBarColor(index: number): string {
    return this.colors[index % this.colors.length];
  }
}

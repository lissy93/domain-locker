import { Component, OnInit, inject } from '@angular/core';
import DatabaseService from '~/app/services/database.service';
import { Router } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { CommonModule } from '@angular/common';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

interface ExpiringDomain {
  domain_name: string;
  expiry_date: string;
  renewal_cost?: number;
  registrar?: string;
  auto_renew: boolean;
}

interface MonthlyExpirations {
  month: number;
  domains: ExpiringDomain[];
  summaryText: string;
}

@Component({
  standalone: true,
  selector: 'app-year-calendar',
  imports: [CommonModule, PrimeNgModule],
  templateUrl: './year-calendar.component.html',
  styleUrls: ['./year-calendar.component.scss'],
})
export class YearCalendarComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);

  selectedYear = new Date().getFullYear();
  currentYear = new Date().getFullYear();
  monthsData: MonthlyExpirations[] = [];
  noExpirations = false;

  ngOnInit(): void {
    this.loadYearData();
  }

  loadYearData(): void {
    this.databaseService.instance.valuationQueries.getDomainCostings().subscribe({
      next: (domains) => {
        const filteredDomains: ExpiringDomain[] = domains
          .filter(
            (domain) =>
              domain.expiry_date &&
              new Date(domain.expiry_date).getFullYear() === this.selectedYear,
          )
          .map((domain) => ({
            domain_name: domain.domain_name || '',
            expiry_date: domain.expiry_date || '',
            renewal_cost: domain.renewal_cost,
            registrar: domain.registrar,
            auto_renew: domain.auto_renew,
          }));

        this.populateMonthsData(filteredDomains);
        this.noExpirations = this.monthsData.every((month) => month.domains.length === 0);
      },
      error: (error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to load domain costings',
          location: 'YearCalendarComponent.loadYearData',
          showToast: true,
        });
      },
    });
  }

  populateMonthsData(domains: ExpiringDomain[]): void {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      domains: [],
      summaryText: '',
    })) as MonthlyExpirations[];

    // Group domains by expiration month
    domains.forEach((domain) => {
      const monthIndex = new Date(domain.expiry_date).getMonth();
      months[monthIndex].domains.push(domain);
    });

    // Generate summary text for each month
    months.forEach((month) => {
      const domainCount = month.domains.length;
      if (domainCount === 0) {
        month.summaryText = `No domains expiring in ${this.getMonthName(month.month)}`;
      } else {
        const registrars = [
          ...new Set(month.domains.map((d) => d.registrar).filter(Boolean)),
        ];
        const totalCost = month.domains.reduce(
          (sum, d) => sum + (d.renewal_cost || 0),
          0,
        );
        const allCostsPresent = month.domains.every((d) => d.renewal_cost !== undefined);
        const anyCostsPresent = month.domains.some((d) => d.renewal_cost !== undefined);

        if (domainCount === 1) {
          month.summaryText = `${domainCount} domain expiring from ${registrars[0]}`;
        } else if (registrars.length === 1) {
          month.summaryText = `${domainCount} domains expiring from ${registrars[0]}`;
        } else {
          month.summaryText = `${domainCount} domains expiring`;
        }

        if (allCostsPresent) {
          month.summaryText += ` at a cost of $${totalCost}`;
        } else if (anyCostsPresent) {
          month.summaryText += ` at a cost of $${totalCost}+`;
        }
      }
    });

    this.monthsData = months;
  }

  getMonthName(month: number): string {
    return new Date(this.selectedYear, month - 1).toLocaleString('default', {
      month: 'short',
    });
  }

  navigateYear(delta: number): void {
    this.selectedYear += delta;
    this.loadYearData();
  }

  onDomainClick(domainName: string): void {
    this.router.navigate(['/domains', domainName]);
  }
}

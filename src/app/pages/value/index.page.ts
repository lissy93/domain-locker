import { Component, OnInit, PLATFORM_ID, ChangeDetectorRef, inject } from '@angular/core';
import DatabaseService from '~/app/services/database.service';
import { MessageService } from 'primeng/api';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { CurrencyService } from '~/app/services/currency.service';

import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DbDomain } from '~/app/../types/Database';

@Component({
  standalone: true,
  selector: 'app-value-page',
  templateUrl: './index.page.html',
  imports: [PrimeNgModule, CommonModule, RouterModule, TableModule],
})
export default class ValuationPageComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  currencyService = inject(CurrencyService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  domains: (DbDomain & {
    purchase_price: number;
    current_value: number;
    renewal_cost: number;
    auto_renew: boolean;
    purchasePriceClass?: string;
    currentValueClass?: string;
    renewalCostClass?: string;
  })[] = [];
  loading = true;
  public currencySymbol = '$';
  public currencyCode = 'USD';

  public totalRenewalCost = 0;
  public portfolioWorth = 0;
  public totalPurchaseCost = 0;
  public totalValue = 0;
  public upcomingPayments: {
    domainName: string;
    expiryDate: string;
    renewalCost: number;
    autoRenew: boolean;
  }[] = [];

  ngOnInit() {
    this.currencySymbol = this.currencyService.getCurrencySymbol();
    this.currencyCode = this.currencyService.getCurrencyCode();
    this.loadDomains();
  }

  // Fetch all domains, including those without value records
  private loadDomains() {
    this.loading = true;
    this.databaseService.instance.listDomains().subscribe({
      next: (domains: DbDomain[]) => {
        this.databaseService.instance.valuationQueries.getDomainCostings().subscribe({
          next: (costings) => {
            // Populate costings or default to 0.0 if not present
            this.domains = domains.map((domain) => {
              const costing = costings.find((c) => c.domain_id === domain.id) || {
                purchase_price: 0.0,
                current_value: 0.0,
                renewal_cost: 0.0,
                auto_renew: false,
              };
              return {
                ...domain,
                purchase_price: costing.purchase_price,
                current_value: costing.current_value,
                renewal_cost: costing.renewal_cost,
                auto_renew: costing.auto_renew,
              };
            });

            this.calculatePercentiles();
            this.calculateSummaryData();
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: (_error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to load domain costings',
            });
            this.loading = false;
            this.cdr.markForCheck();
          },
        });
      },
      error: (_error: Error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load domains',
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // Function to calculate percentiles for purchase price, current value, and renewal cost
  private calculatePercentiles() {
    const purchasePrices = this.domains
      .map((domain) => domain.purchase_price)
      .sort((a, b) => a - b);
    const currentValues = this.domains
      .map((domain) => domain.current_value)
      .sort((a, b) => a - b);
    const renewalCosts = this.domains
      .map((domain) => domain.renewal_cost)
      .sort((a, b) => a - b);

    this.domains.forEach((domain) => {
      domain.purchasePriceClass = this.getClassForPercentile(
        domain.purchase_price,
        purchasePrices,
      );
      domain.currentValueClass = this.getClassForPercentile(
        domain.current_value,
        currentValues,
      );
      domain.renewalCostClass = this.getClassForPercentile(
        domain.renewal_cost,
        renewalCosts,
      );
    });
  }

  // Helper function to determine the class based on percentiles
  private getClassForPercentile(value: number, sortedValues: number[]): string {
    const percentile = (sortedValues.indexOf(value) + 1) / sortedValues.length;

    if (percentile <= 0.33) {
      return 'text-green-400';
    } else if (percentile <= 0.66) {
      return 'text-yellow-400';
    } else if (percentile <= 0.85) {
      return 'text-orange-400';
    } else {
      return 'text-red-400';
    }
  }
  // Calculate the totals and upcoming payments
  private calculateSummaryData() {
    // Reset totals
    this.totalRenewalCost = 0;
    this.totalPurchaseCost = 0;
    this.totalValue = 0;
    this.portfolioWorth = 0;
    this.upcomingPayments = [];

    // Calculate the total renewal cost, portfolio worth, and upcoming payments
    this.domains.forEach((domain) => {
      this.totalRenewalCost += domain.renewal_cost;
      this.totalPurchaseCost += domain.purchase_price;
      this.totalValue += domain.current_value;
    });

    // Portfolio worth = total value - total purchase cost
    this.portfolioWorth = this.totalValue - this.totalPurchaseCost;

    // Calculate upcoming payments (next 5 expiring domains)
    const today = new Date();
    const upcomingDomains = this.domains
      .filter((domain) => domain.expiry_date && new Date(domain.expiry_date) > today)
      .sort(
        (a, b) =>
          new Date(a.expiry_date as Date).getTime() -
          new Date(b.expiry_date as Date).getTime(),
      )
      .slice(0, 5);

    this.upcomingPayments = upcomingDomains.map((domain) => ({
      domainName: domain.domain_name,
      expiryDate: this.transformDate(new Date(domain.expiry_date as Date)),
      renewalCost: domain.renewal_cost,
      autoRenew: domain.auto_renew,
    }));
  }

  private getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th'; // Covers 11th to 20th
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

  public transformDate(date: Date | string | number): string {
    const dateObj = new Date(date);
    const day = dateObj.getDate();
    const suffix = this.getOrdinalSuffix(day);
    const month = dateObj.toLocaleString('default', { month: 'short' });
    return `${day}${suffix} ${month}`;
  }
}

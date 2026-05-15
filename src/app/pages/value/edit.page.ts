import { Component, OnInit, PLATFORM_ID, ChangeDetectorRef, inject } from '@angular/core';
import DatabaseService from '~/app/services/database.service';
import { MessageService } from 'primeng/api';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { localeToCurrency } from '~/app/constants/currencies';
import { TableModule } from 'primeng/table';
import { DbDomain } from '~/app/../types/Database';

@Component({
  standalone: true,
  selector: 'app-value-edit-page',
  templateUrl: './edit.page.html',
  imports: [PrimeNgModule, RouterModule, FormsModule, TableModule],
})
export default class EditDomainValuePage implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  domains: (DbDomain & {
    purchase_price: number;
    current_value: number;
    renewal_cost: number;
    auto_renew: boolean;
  })[] = [];
  loading = true;
  public locale = 'en-US';
  public currency = 'USD';

  ngOnInit() {
    this.loadDomains();
    this.setLocaleAndCurrency();
  }

  // Fetch all domains, including those without value records
  private loadDomains() {
    this.loading = true;
    this.databaseService.instance.listDomains().subscribe({
      next: (domains) => {
        // Fetch domain costings and merge with domains
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
      error: (_error) => {
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

  // Save changes made to the domain values
  saveChanges() {
    const updates = this.domains.map((domain) => ({
      domain_id: domain.id,
      purchase_price: domain.purchase_price,
      current_value: domain.current_value,
      renewal_cost: domain.renewal_cost,
      auto_renew: domain.auto_renew,
    }));

    this.databaseService.instance.valuationQueries
      .updateDomainCostings(updates)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Domain costings updated successfully',
          });
        },
        error: (_error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update domain costings',
          });
        },
      });
  }

  setLocaleAndCurrency() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const userLocale = navigator.language || 'en-US';
        const currencyCode = localeToCurrency[userLocale] || 'USD';
        this.locale = userLocale;
        this.currency = currencyCode;
      } catch {
        this.locale = 'en-US';
        this.currency = 'USD';
      }
    }
  }
}

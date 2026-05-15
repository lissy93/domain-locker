import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CurrencyService {
  private currencyCode: string;
  private currencySymbol: string;

  constructor() {
    const { code, symbol } = this.detectCurrency();
    this.currencyCode = code;
    this.currencySymbol = symbol;
  }

  private detectCurrency(): { code: string; symbol: string } {
    try {
      const locale = navigator.language || 'en-US';
      const region = new Intl.Locale(locale).region || 'US';
      const code = this.getCurrencyForRegion(region);

      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
      });
      const symbol =
        formatter.formatToParts(0).find((p) => p.type === 'currency')?.value || '$';

      return { code, symbol };
    } catch {
      return { code: 'USD', symbol: '$' };
    }
  }

  private getCurrencyForRegion(region: string): string {
    const regionCurrency: Record<string, string> = {
      US: 'USD',
      GB: 'GBP',
      AU: 'AUD',
      CA: 'CAD',
      NZ: 'NZD',
      DE: 'EUR',
      FR: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      NL: 'EUR',
      JP: 'JPY',
      CN: 'CNY',
      KR: 'KRW',
      BR: 'BRL',
      RU: 'RUB',
      IN: 'INR',
    };
    return regionCurrency[region] || 'USD';
  }

  getCurrencyCode(): string {
    return this.currencyCode;
  }

  getCurrencySymbol(): string {
    return this.currencySymbol;
  }

  formatCurrency(amount: number, showDecimals = true): string {
    return new Intl.NumberFormat(navigator.language || 'en-US', {
      style: 'currency',
      currency: this.currencyCode,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount);
  }

  setCurrency(currencyCode: string): void {
    try {
      const formatter = new Intl.NumberFormat(navigator.language, {
        style: 'currency',
        currency: currencyCode,
      });
      this.currencyCode = currencyCode;
      this.currencySymbol =
        formatter.formatToParts(0).find((p) => p.type === 'currency')?.value ||
        currencyCode;
    } catch {
      this.currencyCode = currencyCode;
      this.currencySymbol = currencyCode;
    }
  }
}

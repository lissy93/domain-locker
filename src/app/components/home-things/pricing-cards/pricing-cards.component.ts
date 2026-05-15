import { Component, Input } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { trigger, transition, style, animate } from '@angular/animations';
import {
  pricingFeatures,
  selfHostedFeatures,
  enterpriseFeatures,
  billingFaq,
} from '~/app/constants/pricing-features';

@Component({
  standalone: true,
  selector: 'app-pricing-cards',
  templateUrl: './pricing-cards.component.html',
  imports: [PrimeNgModule],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0 }),
        animate('300ms ease-out', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [animate('300ms ease-in', style({ height: 0, opacity: 0 }))]),
    ]),
  ],
})
export class PricingCardsComponent {
  @Input() showFullPricing = false;

  pricingPlans = pricingFeatures;
  selfHostedFeatures = selfHostedFeatures;
  enterpriseFeatures = enterpriseFeatures;
  billingFaq = billingFaq;

  showEnterprise = false;
  showCharity = false;

  isAnnual = true;
  billingCycleOptions = [
    { label: 'Annual', value: true, icon: 'pi pi-calendar-plus' },
    { label: 'Monthly', value: false, icon: 'pi pi-calendar-minus' },
  ];

  toggleBilling() {
    this.isAnnual = !this.isAnnual;
  }

  getPrice(plan: { priceAnnual?: string; priceMonth?: string }) {
    return this.isAnnual ? plan.priceAnnual : plan.priceMonth;
  }
}

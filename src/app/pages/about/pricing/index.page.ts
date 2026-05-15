import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { billingFaq } from '~/app/constants/pricing-features';

import { PricingCardsComponent } from '~/app/components/home-things/pricing-cards/pricing-cards.component';
import { CtaComponent } from '~/app/components/home-things/cta/cta.component';

@Component({
  standalone: true,
  selector: 'app-about-pricing-page',
  templateUrl: './index.page.html',
  imports: [PrimeNgModule, PricingCardsComponent, CtaComponent],
})
export default class PricingPage {
  billingFaq = billingFaq;
}

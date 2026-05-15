import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { FeaturesGridComponent } from '~/app/components/home-things/feature-grid/feature-grid.component';
import { CtaComponent } from '~/app/components/home-things/cta/cta.component';

@Component({
  selector: 'app-about-features-page',
  standalone: true,
  imports: [PrimeNgModule, FeaturesGridComponent, CtaComponent],
  templateUrl: './index.page.html',
})
export default class FeaturesPage {}

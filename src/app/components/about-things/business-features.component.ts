import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

import { businessFeatures } from '~/app/pages/about/data/feature-comparison';

@Component({
  standalone: true,
  selector: 'app-business-features',
  template: `
    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 gap-3">
      @for (feature of features; track feature) {
        <div class="p-card p-3">
          <h3>{{ feature.emoji }} {{ feature.title }}</h3>
          <h4 class="text-primary-600">{{ feature.subtitle }}</h4>
          <p class="m-0">{{ feature.description }}</p>
        </div>
      }
    </div>
  `,
  imports: [PrimeNgModule],
})
export class BusinessFeaturesComponent {
  features = businessFeatures;
}

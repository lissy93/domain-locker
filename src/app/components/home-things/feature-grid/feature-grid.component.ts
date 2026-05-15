import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { DlIconComponent } from '~/app/components/misc/svg-icon.component';
import { features } from '~/app/pages/about/data/feature-comparison';

@Component({
  selector: 'app-feature-grid',
  standalone: true,
  imports: [PrimeNgModule, DlIconComponent],
  template: `
    <ul
      class="p-0 list-none grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      @for (feature of features; track feature) {
        <li class="p-card p-4">
          <div class="flex gap-2 items-center mb-2">
            @if (feature.icon) {
              <app-dl-icon
                [icon]="feature.icon"
                [viewBox]="feature.iconViewBox || '0 0 512 512'"
                class="min-w-[3rem] text-center h-12 rounded bg-surface-100 p-2"
                classNames="h-full"
                color="var(--primary-400)"
              />
            }
            <h4 class="m-0 mb-2 font-semmibold">{{ feature.featureTitle }}</h4>
          </div>
          <ul class="pl-3">
            @for (featureInfo of feature.featureInfo; track featureInfo) {
              <li>
                {{ featureInfo }}
              </li>
            }
          </ul>
        </li>
      }
    </ul>
  `,
})
export class FeaturesGridComponent {
  public features = features;
}

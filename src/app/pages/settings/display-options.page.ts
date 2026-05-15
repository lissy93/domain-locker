import { PrimeNgModule } from '~/app/prime-ng.module';

import { Component } from '@angular/core';
import { UiSettingsComponent } from '~/app/components/settings/ui-options/ui-options.component';

@Component({
  standalone: true,
  selector: 'app-settings-display-options-page',
  imports: [PrimeNgModule, UiSettingsComponent],
  templateUrl: './display-options.page.html',
  styles: [
    `
      ::ng-deep .ui-settings-wrap.stand-alone {
        background: none !important;
        font-size: 1em;
        width: 16rem;
        box-shadow: none !important;
        display: flex;
        flex-wrap: wrap;
        width: 98%;
        gap: 1rem;
        .ui-settings-section {
          border-radius: 4px;
          padding: 1rem;
          min-width: 15rem;
          margin-bottom: 0 !important;
          h3 {
            font-size: 1.2rem !important;
            margin-bottom: 1rem !important;
          }
        }
      }
    `,
  ],
})
export default class DisplayOptionsPageComponent {}

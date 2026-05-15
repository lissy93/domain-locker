import { Component } from '@angular/core';
import { DomainUpdatesComponent } from '~/app/components/domain-things/domain-updates/domain-updates.component';
import { ChangeHistoryChartComponent } from '~/app/components/charts/change-history/change-history.component';

@Component({
  standalone: true,
  selector: 'app-stats-change-frequency-page',
  template: `
    <h1>Change Frequency</h1>
    <div class="flex flex-col gap-2">
      <app-change-history-chart />
      <h2 class="mb-0 mt-4">Recent Change Log</h2>
      <app-domain-updates />
    </div>
  `,
  imports: [DomainUpdatesComponent, ChangeHistoryChartComponent],
  styles: [
    `
      ::ng-deep .filter-button {
        display: none;
      }
      ::ng-deep .change-summary {
        display: inline !important;
        span {
          margin: 0 0.2rem 0 0.2rem;
        }
      }
    `,
  ],
})
export default class ChangeFrequencyPage {}

import { Component } from '@angular/core';
import { TldOrganizationChartComponent } from '~/app/components/charts/domain-hierarchy/domain-hierarchy.component';

@Component({
  standalone: true,
  selector: 'app-stats-tld-sub-map-page',
  template: `
    <h1 class="mt-2 mb-4">TLD and Subdomain Hierarchy</h1>
    <app-tld-organization-chart />
  `,
  imports: [TldOrganizationChartComponent],
  styles: [
    `
      ::ng-deep app-tld-organization-chart {
        max-width: 100%;
        display: block;
        overflow-x: scroll;
      }
    `,
  ],
})
export default class HostMapPage {}

import { Component } from '@angular/core';
import { DomainPieChartsComponent } from '~/app/components/charts/domain-pie/domain-pie.component';

@Component({
  standalone: true,
  selector: 'app-stats-domain-providers-page',
  template: '<h1>Domain Providers</h1><app-domain-pie-charts [listMode]="true" />',
  imports: [DomainPieChartsComponent],
})
export default class DomainProvidersPage {}

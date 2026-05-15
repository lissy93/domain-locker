import { Component } from '@angular/core';
import { DomainValuationChartComponent } from '~/app/components/charts/domain-valuation/domain-valuation.component';

@Component({
  standalone: true,
  selector: 'app-stats-cost-analysis-page',
  template: `
    <h1>Cost Analysis</h1>
    <app-domain-valuation-chart />
    <!-- <div class="flex flex-col gap-8">
      <app-tag-cloud />
    </div> -->
  `,
  imports: [DomainValuationChartComponent],
  styles: [],
})
export default class CostAnalysisPage {}

import { Component } from '@angular/core';
import { DomainTagCloudComponent } from '~/app/components/charts/tag-cloud/tag-cloud.component';
import { TagGridComponent } from '~/app/components/tag-grid/tag-grid.component';

@Component({
  standalone: true,
  selector: 'app-stats-tag-cloud-page',
  template: `
    <h1>Tags</h1>
    <div class="flex flex-col gap-8">
      <app-tag-cloud />
      <app-tag-grid [miniGrid]="true" />
    </div>
  `,
  imports: [DomainTagCloudComponent, TagGridComponent],
  styles: ['::ng-deep .cloud-view-all { display: none !important;  }'],
})
export default class HostMapPage {}

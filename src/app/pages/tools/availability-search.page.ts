import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  standalone: true,
  imports: [PrimeNgModule],
  selector: 'app-tools-availability-search-page',
  templateUrl: './availability-search.page.html',
  styles: ['::ng-deep .content-container { max-width: 1600px; }'],
})
export default class ToolsAvailabilityPageComponent {}

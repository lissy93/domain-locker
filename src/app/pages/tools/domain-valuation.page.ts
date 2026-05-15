import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  standalone: true,
  imports: [PrimeNgModule],
  selector: 'app-tools-domain-valuation-page',
  templateUrl: './domain-valuation.page.html',
  styles: ['::ng-deep .content-container { max-width: 1600px; }'],
})
export default class ToolsValuationPageComponent {}

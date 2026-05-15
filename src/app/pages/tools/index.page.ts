import { RouterOutlet } from '@angular/router';
import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  standalone: true,
  imports: [RouterOutlet, PrimeNgModule],
  selector: 'app-tools-page',
  templateUrl: './index.page.html',
  styles: ['::ng-deep .content-container { max-width: 1600px; }'],
})
export default class ToolsIndexPageComponent {}

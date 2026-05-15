import { RouterOutlet } from '@angular/router';
import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

import { ExtendedMenuItem, toolsLinks } from '~/app/constants/navigation-links';
import { DlIconComponent } from '~/app/components/misc/svg-icon.component';

@Component({
  standalone: true,
  imports: [RouterOutlet, PrimeNgModule, DlIconComponent],
  selector: 'app-tools-layout-page',
  templateUrl: './tools/layout.html',
  styles: ['::ng-deep .content-container { max-width: 1600px; }', ``],
})
export default class ToolsIndexPageComponent {
  toolsLinks: ExtendedMenuItem[] = toolsLinks;
}
